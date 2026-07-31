// Classify the latest incoming message: Positive | Negative | Objection
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { traceStep, logError } from "../_shared/observability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
import { chatCompletion, MODELS } from "../_shared/openrouter.ts";
import { setLeadStatus } from "../_shared/memory.ts";
import { keywordSentiment } from "../_shared/sentiment.ts";

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

    const out = await chatCompletion(MODELS.agent, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ], { temperature: 0, max_tokens: 8 });
    if (!out) {
      console.error("classifier LLM error: no response from OpenRouter");
      await logError("classify", "OpenRouter returned no response", { prospect_id, message_id });
      await traceStep(prospect_id, message_id, "classified", "failed", {}, "openrouter_failed");
      return new Response(JSON.stringify({ error: "llm_failed" }), { status: 502, headers: corsHeaders });
    }
    const raw: string = out.content || "";
    const clean = raw.replace(/[^A-Za-z]/g, "");
    let classification: "Positive" | "Negative" | "Objection" = "Objection";
    let ruleFired = "ai_classification";
    if (/^positive$/i.test(clean)) classification = "Positive";
    else if (/^negative$/i.test(clean)) classification = "Negative";
    else if (/^objection$/i.test(clean)) { classification = "Objection"; }
    else {
      // n8n rule: if demo NOT sent yet, never default to Objection.
      // Bias unclear replies to Negative pre-demo (won't auto-send anything pushy),
      // and to Objection post-demo (matches n8n switch fallthrough).
      classification = demoSent ? "Objection" : "Negative";
      ruleFired = demoSent ? "fallback_post_demo→Objection" : "fallback_pre_demo→Negative";
    }

    // n8n rule enforcement: pre-demo can never be Objection.
    if (!demoSent && classification === "Objection") {
      classification = "Negative";
      ruleFired = "enforced_pre_demo_no_objection";
    }

    if (demoSent && classification === "Positive") {
      // Per v2 rules: demo already sent -> Positive stays Positive (post-demo)
      ruleFired = "demo_sent=true → post_demo Positive";
    }

    // Deterministic keyword sentiment overrides the model so the locked
    // reply templates fire consistently.
    const kw = keywordSentiment(current?.body || "");
    if (kw && kw !== classification) {
      classification = kw;
      ruleFired = `keyword_override→${kw}`;
    } else if (kw) {
      ruleFired = `${ruleFired}+keyword_confirmed`;
    }

    await supabase.from("inbox_messages")
      .update({ classification, classified_by: ruleFired.startsWith("keyword_override") ? "keyword" : "ai" }).eq("id", message_id);
    await supabase.from("prospects")
      .update({ last_classification: classification }).eq("id", prospect_id);
    // Memory continuity: persist lead status so later turns remember a decline.
    try { await setLeadStatus(prospect_id, classification); } catch (_) { /* noop */ }

    await traceStep(prospect_id, message_id, "classified", "ok", {
      classification, raw_output: raw, rule_fired: ruleFired,
      demo_sent: demoSent, model: out.usedModel,
    });

    return new Response(JSON.stringify({ classification, raw_output: raw, rule_fired: ruleFired }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("inbox-classify error:", e);
    const m = String((e as any)?.message || e);
    await logError("classify", m, { prospect_id: null, message_id: null, stack: (e as any)?.stack });
    return new Response(JSON.stringify({ error: m }), { status: 500, headers: corsHeaders });
  }
});
