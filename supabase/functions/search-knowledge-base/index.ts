import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

export async function embedText(text: string): Promise<number[] | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai/text-embedding-3-small", input: text.slice(0, 8000) }),
    });
    if (!res.ok) {
      console.warn("embed failed", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const data = await res.json();
    return data?.data?.[0]?.embedding || null;
  } catch (e) {
    console.warn("embed err", e);
    return null;
  }
}

export async function searchKB(chatbotId: string, query: string, limit = 5) {
  const emb = await embedText(query);
  if (!emb) return [];
  const { data, error } = await supabase.rpc("match_kb_entries", {
    p_chatbot_id: chatbotId,
    p_query_embedding: emb as any,
    p_match_count: limit,
  });
  if (error) {
    console.warn("match_kb_entries err", error);
    return [];
  }
  return data || [];
}

// Vapi tool-call shape: { message: { toolCalls: [{ id, function: { name, arguments } }], assistant: {...}, ... } }
function extractVapiCall(body: any): { chatbotId?: string; query?: string; topK?: number; toolCallId?: string } | null {
  const tc = body?.message?.toolCalls?.[0] || body?.toolCalls?.[0];
  if (!tc) return null;
  let args: any = tc?.function?.arguments;
  if (typeof args === "string") {
    try { args = JSON.parse(args); } catch { args = {}; }
  }
  const meta = body?.message?.assistant?.metadata || body?.message?.call?.assistantOverrides?.metadata || body?.metadata || {};
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

    // Try Vapi tool-call shape first
    const vapi = extractVapiCall(body);
    let chatbotId: string | undefined;
    let query: string | undefined;
    let limit = 5;
    let toolCallId: string | undefined;

    if (vapi && vapi.query) {
      chatbotId = vapi.chatbotId;
      query = vapi.query;
      limit = vapi.topK || 5;
      toolCallId = vapi.toolCallId;
    } else {
      chatbotId = body.chatbotId;
      query = body.query;
      limit = body.limit || 5;
    }

    if (!chatbotId || !query) {
      // Vapi expects a results array even on error so the agent can speak fallback
      if (toolCallId) {
        return new Response(JSON.stringify({
          results: [{ toolCallId, result: "Let me check with our team on that." }],
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "chatbotId and query required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = await searchKB(chatbotId, query, limit);

    // Vapi tool-call response format
    if (toolCallId) {
      const text = (results && results.length > 0)
        ? results.map((r: any) => `${r.title ? r.title + ": " : ""}${r.content}`).join("\n\n").slice(0, 4000)
        : "Let me check with our team on that.";
      return new Response(JSON.stringify({
        results: [{ toolCallId, result: text }],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
