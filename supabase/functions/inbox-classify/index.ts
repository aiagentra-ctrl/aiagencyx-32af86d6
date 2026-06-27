// Classify the latest incoming message: Positive | Negative | Objection
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

async function loadClassifierPrompt(): Promise<string> {
  const { data } = await supabase
    .from("inbox_prompts").select("system_prompt").eq("classification", "Classifier").maybeSingle();
  return data?.system_prompt
    || `Classify the reply as exactly one of: Positive, Negative, Objection. Output only the single word.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { prospect_id, message_id } = await req.json();
    if (!prospect_id || !message_id) {
      return new Response(JSON.stringify({ error: "prospect_id and message_id required" }), { status: 400, headers: corsHeaders });
    }

    const { data: messages } = await supabase
      .from("inbox_messages").select("direction, body, created_at")
      .eq("prospect_id", prospect_id).order("created_at", { ascending: true });

    const { data: current } = await supabase
      .from("inbox_messages").select("body").eq("id", message_id).single();

    const demoSent = (messages || []).some(
      (m) => m.direction === "outgoing" && (m.body || "").includes("aiagentfor.lovable.app"),
    );

    const history = (messages || [])
      .map((m) => `[${m.direction.toUpperCase()}] ${m.body}`)
      .join("\n\n");

    const systemPrompt = await loadClassifierPrompt();
    const userPrompt = `THREAD HISTORY:\n${history}\n\nDEMO_SENT: ${demoSent}\n\nLATEST INCOMING MESSAGE:\n${current?.body || ""}\n\nReturn only one word.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0,
        max_tokens: 8,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("classifier LLM error:", res.status, t);
      return new Response(JSON.stringify({ error: "llm_failed", status: res.status }), { status: 502, headers: corsHeaders });
    }
    const j = await res.json();
    const raw: string = j?.choices?.[0]?.message?.content || "";
    const clean = raw.replace(/[^A-Za-z]/g, "");
    let classification: "Positive" | "Negative" | "Objection" = "Objection";
    if (/^positive$/i.test(clean)) classification = "Positive";
    else if (/^negative$/i.test(clean)) classification = "Negative";
    else classification = "Objection";

    await supabase.from("inbox_messages")
      .update({ classification, classified_by: "ai" }).eq("id", message_id);
    await supabase.from("prospects")
      .update({ last_classification: classification }).eq("id", prospect_id);

    return new Response(JSON.stringify({ classification }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("inbox-classify error:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: corsHeaders });
  }
});
