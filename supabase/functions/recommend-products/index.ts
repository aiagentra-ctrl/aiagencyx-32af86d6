// Product recommendation engine — pgvector similarity search.
// Used by chatbot-conversation (direct) and Vapi voice agent (tool-call shape).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createEmbedding, chatCompletion, MODELS } from "../_shared/openrouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

export async function recommend(chatbotId: string, query: string, topK = 5): Promise<any[]> {
  const emb = await createEmbedding(query);
  if (!emb) {
    // fallback: ilike search
    const { data } = await supabase
      .from("products").select("*").eq("chatbot_id", chatbotId)
      .or(`name.ilike.%${query}%,description.ilike.%${query}%`).limit(topK);
    return data || [];
  }
  // Prefer hybrid search (in-stock-boosted); fall back to legacy match_products.
  const { data: hybrid, error: hybridErr } = await supabase.rpc("match_products_hybrid", {
    p_chatbot_id: chatbotId,
    p_query_embedding: emb as any,
    p_query_text: query,
    p_match_count: topK,
    p_filters: {},
  });
  if (!hybridErr && Array.isArray(hybrid)) {
    // In-stock first, then by combined_score.
    return [...hybrid].sort((a: any, b: any) => {
      if (!!a.in_stock !== !!b.in_stock) return a.in_stock ? -1 : 1;
      return (b.combined_score ?? 0) - (a.combined_score ?? 0);
    });
  }
  const { data, error } = await supabase.rpc("match_products", {
    p_chatbot_id: chatbotId, p_query_embedding: emb as any, p_match_count: topK,
  });
  if (error) {
    console.warn("match_products err", error);
    return [];
  }
  return data || [];
}

function extractVapiCall(body: any): { chatbotId?: string; query?: string; topK?: number; toolCallId?: string } | null {
  const tc = body?.message?.toolCalls?.[0] || body?.toolCalls?.[0];
  if (!tc) return null;
  let args: any = tc?.function?.arguments;
  if (typeof args === "string") { try { args = JSON.parse(args); } catch { args = {}; } }
  const meta = body?.message?.assistant?.metadata || body?.message?.call?.assistantOverrides?.metadata || {};
  return {
    chatbotId: args?.chatbotId || meta?.chatbot_id || meta?.chatbotId,
    query: args?.query || args?.q,
    topK: args?.top_k || args?.topK || 5,
    toolCallId: tc?.id,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const vapi = extractVapiCall(body);
    let chatbotId: string | undefined;
    let query: string | undefined;
    let topK = 5;
    let toolCallId: string | undefined;

    if (vapi && vapi.query) {
      chatbotId = vapi.chatbotId; query = vapi.query; topK = vapi.topK || 5; toolCallId = vapi.toolCallId;
    } else {
      chatbotId = body.chatbotId; query = body.query; topK = body.top_k || body.limit || 5;
    }

    if (!chatbotId || !query) {
      if (toolCallId) {
        return new Response(JSON.stringify({
          results: [{ toolCallId, result: "I couldn't find products matching that. Want me to check something else?" }],
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "chatbotId and query required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const products = await recommend(chatbotId, query, topK);

    if (toolCallId) {
      // Voice: use Claude Haiku to craft a natural 1-2 sentence spoken reply.
      let text: string;
      if (products.length === 0) {
        text = "I don't see anything matching that in stock right now. Want to try something else?";
      } else {
        const top = products.slice(0, 2).map((p: any) =>
          `${p.name} for ${p.price ?? "?"}${p.description ? ` — ${String(p.description).slice(0, 80)}` : ""}`
        ).join(" and ");
        const spoken = await chatCompletion(MODELS.voice, [
          { role: "system", content: "You are a voice shopping assistant. Reply in max 2 spoken sentences. Say prices naturally (e.g. 'forty nine ninety-nine'). Say 'We have' not 'The store has'. End by offering to hear more or see another option." },
          { role: "user", content: `Customer asked: "${query}". Best matches: ${top}. Reply naturally.` },
        ], { temperature: 0.3, max_tokens: 150 });
        text = spoken?.content?.trim() || `We have the ${products[0].name}. Want to hear more?`;
      }
      return new Response(JSON.stringify({
        results: [{ toolCallId, result: text }],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ products }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
