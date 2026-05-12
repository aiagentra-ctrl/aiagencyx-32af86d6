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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { chatbotId, query, limit } = await req.json();
    if (!chatbotId || !query) {
      return new Response(JSON.stringify({ error: "chatbotId and query required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const results = await searchKB(chatbotId, query, limit || 5);
    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
