// Product recommendation engine — pgvector similarity search.
// Used by chatbot-conversation (direct) and Vapi voice agent (tool-call shape).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");

async function embed(text: string): Promise<number[] | null> {
  if (!LOVABLE_KEY) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai/text-embedding-3-small", input: text.slice(0, 4000) }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.[0]?.embedding || null;
  } catch { return null; }
}

export async function recommend(chatbotId: string, query: string, topK = 5): Promise<any[]> {
  const emb = await embed(query);
  if (!emb) {
    // fallback: ilike search
    const { data } = await supabase
      .from("products").select("*").eq("chatbot_id", chatbotId)
      .or(`name.ilike.%${query}%,description.ilike.%${query}%`).limit(topK);
    return data || [];
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
      const text = products.length > 0
        ? products.slice(0, 3).map((p: any) =>
            `${p.name}${p.price ? ` — ${p.currency || "$"}${p.price}` : ""}${p.description ? `: ${String(p.description).slice(0, 120)}` : ""}`
          ).join(". ")
        : "I don't see anything matching that in stock right now.";
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
