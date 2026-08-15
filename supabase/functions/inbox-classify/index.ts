// Classify the latest incoming message with real intent reading (AI + full
// thread history), not keyword matching. Output is exactly one of:
// Positive | Negative | Objection
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { traceStep, logError } from "../_shared/observability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
import { chatCompletion, MODELS } from "../_shared/openrouter.ts";
import { setLeadStatus } from "../_shared/memory.ts";
import { keywordSentiment, isHardOptOut, extractReplyText } from "../_shared/sentiment.ts";

const DEMO_DOMAINS = ["aiagentfor.lovable.app", "aiagencyx.lovable.app"];

const DEFAULT_CLASSIFIER_PROMPT = `You are an AI classification agent. Your ONLY job is to read a prospect's reply IN CONTEXT and return ONE word: Positive, Negative or Objection. Nothing else.

PROCESS
1. Read the FULL thread history first. Never judge the latest message in isolation.
2. Read the CURRENT reply for real intent, not keywords. Sarcasm, politeness and indirect wording still count as intent.

RULES
- Positive: the person clearly wants the demo/link or wants to proceed ("yes send me the link", "I'm interested", "how do I start", "book a time").
- Negative: the person clearly rejects, declines, dismisses or opts out ("not interested", "no", "stop", "unsubscribe", "maybe later", or any dismissive/sarcastic rejection such as "if this email is indicative of its quality, then it is a no").
- Objection: they are asking questions, unsure, delaying, or the message is unclear.

DEMO LINK CONDITION (critical)
- DEMO_SENT is given to you. It is true when a demo link was already sent in this thread.
- If DEMO_SENT is false: you may ONLY answer Positive or Negative. Objection is forbidden — there is nothing to object to yet.
- If DEMO_SENT is true: if the reply is not clearly Positive or Negative, answer Objection.

NEVER
- Never guess unclear intent as Positive.
- Never skip the history.
- Never output a sentence, explanation or punctuation. One word only.`;

async function loadClassifierPrompt(): Promise<string> {
  const { data } = await supabase
    .from("inbox_prompts").select("system_prompt").eq("classification", "Classifier").maybeSingle();
  const stored = (data?.system_prompt || "").trim();
  // Only use a stored prompt if it actually encodes the intent rules.
  return stored.length > 200 ? stored : DEFAULT_CLASSIFIER_PROMPT;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { prospect_id, message_id } = await req.json();
    if (!prospect_id || !message_id) {
      return new Response(JSON.stringify({ error: "prospect_id and message_id required" }), { status: 400, headers: corsHeaders });
    }

    const [{ data: messages }, { data: current }, { data: demos }, { data: memory }, { data: prospect }] =
      await Promise.all([
        supabase.from("inbox_messages").select("direction, body, classification, created_at")
          .eq("prospect_id", prospect_id).order("created_at", { ascending: true }),
        supabase.from("inbox_messages").select("body").eq("id", message_id).single(),
        supabase.from("inbox_demos").select("demo_url").eq("prospect_id", prospect_id).limit(1),
        supabase.from("prospect_memory")
          .select("lead_status, conversation_stage, classification_history, total_replies_received, pitch_count")
          .eq("prospect_id", prospect_id).maybeSingle(),
        supabase.from("prospects").select("last_classification, firstname, company").eq("id", prospect_id).maybeSingle(),
      ]);

    // Log that lead memory + history were actually read before classifying.
    await traceStep(prospect_id, message_id, "memory_read", "ok", {
      messages_in_thread: (messages || []).length,
      prior_classifications: (messages || []).map((m) => m.classification).filter(Boolean),
      lead_status: memory?.lead_status ?? null,
      conversation_stage: memory?.conversation_stage ?? null,
      last_classification: prospect?.last_classification ?? null,
      memory_found: !!memory,
    });

    // Demo-sent detection: an actual demo record, or a demo domain anywhere
    // in the outgoing thread.
    const demoSent = (demos || []).length > 0 || (messages || []).some(
      (m) => m.direction === "outgoing" && DEMO_DOMAINS.some((d) => (m.body || "").includes(d)),
    );

    const cleanCurrent = extractReplyText(current?.body || "");
    const history = (messages || [])
      .map((m) => {
        const tag = m.classification ? ` (classified: ${m.classification})` : "";
        return `[${m.direction.toUpperCase()}${tag}] ${extractReplyText(m.body || "").slice(0, 800)}`;
      })
      .join("\n\n");

    const priorClassifications = (messages || []).map((m) => m.classification).filter(Boolean);
    const leadContext = [
      `LEAD_STATUS: ${memory?.lead_status ?? "unknown"}`,
      `CONVERSATION_STAGE: ${memory?.conversation_stage ?? "unknown"}`,
      `LAST_CLASSIFICATION: ${prospect?.last_classification ?? "none"}`,
      `PRIOR_CLASSIFICATIONS: ${priorClassifications.length ? priorClassifications.join(" -> ") : "none"}`,
      `TOTAL_REPLIES_RECEIVED: ${memory?.total_replies_received ?? 0}`,
    ].join("\n");

    const systemPrompt = await loadClassifierPrompt();
    const userPrompt = `LEAD MEMORY:\n${leadContext}\n\nFULL THREAD HISTORY (oldest -> newest):\n${history}\n\nDEMO_SENT: ${demoSent}\n\nCURRENT REPLY (this is what you classify):\n${cleanCurrent}\n\nReturn only one word: Positive, Negative or Objection.`;

    const out = await chatCompletion(MODELS.agent, [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ], { temperature: 0, max_tokens: 8 });

    const raw: string = out?.content || "";
    const clean = raw.replace(/[^A-Za-z]/g, "");

    // Deterministic safety net (only fires on unambiguous text).
    const kw = keywordSentiment(current?.body || "");
    const optOut = isHardOptOut(current?.body || "");

    let classification: "Positive" | "Negative" | "Objection";
    let ruleFired: string;

    if (/^positive$/i.test(clean)) { classification = "Positive"; ruleFired = "ai_intent"; }
    else if (/^negative$/i.test(clean)) { classification = "Negative"; ruleFired = "ai_intent"; }
    else if (/^objection$/i.test(clean)) { classification = "Objection"; ruleFired = "ai_intent"; }
    else {
      // Model failed or returned junk: fall back to the safety net, never to
      // Positive-by-default.
      classification = kw === "Positive" ? "Positive" : kw === "Negative" ? "Negative" : (demoSent ? "Objection" : "Negative");
      ruleFired = out ? "ai_unparsable→safety_net" : "ai_failed→safety_net";
    }

    // A clear opt-out or explicit refusal always wins over the model.
    if (optOut || kw === "Negative") {
      if (classification !== "Negative") ruleFired = `override_negative(${ruleFired})`;
      classification = "Negative";
    }

    // Pre-demo can never be Objection (nothing to object to yet).
    if (!demoSent && classification === "Objection") {
      classification = kw === "Positive" ? "Positive" : "Negative";
      ruleFired = `${ruleFired}+pre_demo_no_objection`;
    }

    const { error: msgErr } = await supabase.from("inbox_messages")
      .update({ classification, classified_by: ruleFired.startsWith("ai_intent") ? "ai" : "rule" })
      .eq("id", message_id);
    if (msgErr) {
      console.error("classification write-back failed:", msgErr.message);
      await logError("classify", `classification write-back failed: ${msgErr.message}`, { prospect_id, message_id });
    }
    await supabase.from("prospects")
      .update({ last_classification: classification, ...(optOut ? { automation_paused: true } : {}) })
      .eq("id", prospect_id);
    try { await setLeadStatus(prospect_id, classification); } catch (_) { /* noop */ }

    await traceStep(prospect_id, message_id, "classified", "ok", {
      classification, raw_output: raw, rule_fired: ruleFired,
      demo_sent: demoSent, keyword_net: kw, hard_opt_out: optOut,
      model: out?.usedModel, clean_reply: cleanCurrent.slice(0, 300),
    });

    return new Response(JSON.stringify({
      classification, raw_output: raw, rule_fired: ruleFired,
      demo_sent: demoSent, hard_opt_out: optOut,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("inbox-classify error:", e);
    const m = String((e as any)?.message || e);
    await logError("classify", m, { prospect_id: null, message_id: null, stack: (e as any)?.stack });
    return new Response(JSON.stringify({ error: m }), { status: 500, headers: corsHeaders });
  }
});
