// Generate an AI reply for a prospect based on classification.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getOrCreateMemory, canSendDemoLink, stripDemoUrls, memoryPromptBlock } from "../_shared/memory.ts";
import { chatCompletion, MODELS, normalizeModel } from "../_shared/openrouter.ts";
import { finalizeReply, DEFAULT_SENDER_NAME, senderName } from "../_shared/reply-format.ts";
import { keywordSentiment, renderTemplate } from "../_shared/sentiment.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// Hard output contract appended to every agent prompt.
const FORMAT_RULES = (name: string, url: string) => `

OUTPUT FORMAT (STRICT — the message is rejected if you break this):
- Maximum TWO short sentences. No paragraphs. No bullet lists. No subject line.
- If a link is included, put the RAW URL on its own line. Never wrap it in markdown, never write [text](url), never put brackets around anything.
- End with exactly these two lines and nothing after them:
Best,
${name}
- Never repeat the link. Never write "Regards," and "Best," together. Never put the sign-off inside brackets.
${url ? `- The only allowed link is: ${url}` : "- Do not include any link."}

Examples of correct output:
Here it is: ${url || "https://example.com/demo"}

Best,
${name}
---
Got it 👍 — this was actually made specifically for you.
${url || "https://example.com/demo"}

Best,
${name}`;

// Map classification → node_prompts.node_name
const CLASS_TO_NODE: Record<string, string> = {
  Positive: "positive_reply",
  Negative: "negative_reply",
  Objection: "objection_reply",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { prospect_id, classification, demo_url } = await req.json();
    if (!prospect_id || !classification) {
      return new Response(JSON.stringify({ error: "prospect_id and classification required" }), { status: 400, headers: corsHeaders });
    }

    const nodeName = CLASS_TO_NODE[classification] ?? null;
    const [{ data: prospect }, { data: nodePromptRow }, { data: legacyPromptRow }, { data: messages }, { data: existingDemo }, memory] = await Promise.all([
      supabase.from("prospects").select("*").eq("id", prospect_id).single(),
      nodeName
        ? supabase.from("node_prompts").select("system_prompt, model").eq("node_name", nodeName).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("inbox_prompts").select("system_prompt").eq("classification", classification).maybeSingle(),
      supabase.from("inbox_messages").select("direction, body, created_at").eq("prospect_id", prospect_id).order("created_at", { ascending: true }).limit(20),
      supabase.from("inbox_demos").select("demo_url").eq("prospect_id", prospect_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      getOrCreateMemory(prospect_id),
    ]);

    if (!prospect) {
      return new Response(JSON.stringify({ error: "prospect not found" }), { status: 404, headers: corsHeaders });
    }

    // Layer 1: memory check — if demo already sent, LOCK the link out.
    const demoAllowed = canSendDemoLink(memory);
    const usableDemoUrl = demoAllowed ? (demo_url || existingDemo?.demo_url || "") : "";
    const name = senderName(prospect);

    const rawPrompt =
      nodePromptRow?.system_prompt ||
      legacyPromptRow?.system_prompt ||
      "Reply briefly and politely.";
    const model = normalizeModel(nodePromptRow?.model) || MODELS.agent;
    // Substitute {{demo_url}} inside the agent's system prompt so the model
    // always has the exact URL available even if it ignores the user context.
    let systemPrompt = rawPrompt.replace(/\{\{\s*demo_url\s*\}\}/gi, usableDemoUrl);

    // Layer 2: prompt injection — hard instruction never to send demo link
    // if it's already been sent.
    if (!demoAllowed) {
      systemPrompt += `\n\nSTRICT RULE: A demo link has already been sent to this prospect. Under no circumstances include a demo URL, demo link, or any URL of the form /demo/... in your reply. Focus on continuing the conversation.`;
    }

    // Memory continuity + hard formatting contract.
    systemPrompt += memoryPromptBlock(memory);
    systemPrompt += FORMAT_RULES(name, demoAllowed ? usableDemoUrl : "");

    const lastIncoming = [...(messages || [])].reverse().find((m: any) => m.direction === "incoming");

    // ---------------------------------------------------------------------
    // Locked template path: deterministic keyword sentiment wins over the LLM.
    // The stored template is sent verbatim, with only the locked variables
    // (notably {DemoLink} = this lead's own tracked demo URL) substituted.
    // ---------------------------------------------------------------------
    const kw = keywordSentiment(lastIncoming?.body || "");
    if (kw) {
      const phase = memory?.demo_link_sent ? "post_demo" : "pre_demo";
      const { data: tplRows } = await supabase
        .from("reply_templates")
        .select("body, phase, is_default")
        .eq("classification", kw)
        .eq("is_default", true);
      const tpl = (tplRows || []).find((t: any) => t.phase === phase) || (tplRows || [])[0];
      if (tpl?.body) {
        const trackedDemoUrl = demo_url || existingDemo?.demo_url || "";
        const text = renderTemplate(tpl.body, {
          demo_url: trackedDemoUrl,
          firstname: prospect.firstname || "there",
          company: prospect.company || "your team",
          sender_name: name || DEFAULT_SENDER_NAME,
        });
        return new Response(JSON.stringify({
          reply: text,
          demo_url: trackedDemoUrl,
          demo_link_locked: false,
          sanitizer_fired: false,
          model: "locked_template",
          sender_name: name || DEFAULT_SENDER_NAME,
          valid: true,
          needs_review: false,
          validation_errors: [],
          attempts: 0,
          node_prompt_used: false,
          template_used: `${kw}:${tpl.phase}`,
          keyword_sentiment: kw,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const context = `Prospect:
- firstname: ${prospect.firstname || "there"}
- company: ${prospect.company || "(unknown)"}
- email: ${prospect.email}
demo_url: ${demoAllowed ? (usableDemoUrl || "(none yet)") : "(ALREADY SENT — DO NOT INCLUDE)"}

User's last message:
${lastIncoming?.body || "(no incoming yet)"}

Recent thread (oldest -> newest):
${(messages || []).map((m) => `[${m.direction}] ${m.body}`).join("\n\n")}

Write the reply body now.${demoAllowed ? " Use the demo_url exactly as given." : ""}`;

    const messagesPayload = [
      { role: "system", content: systemPrompt },
      { role: "user", content: context },
    ];

    // Generate, then normalize + validate. Retry generation once on failure.
    let reply = "";
    let validation = { ok: false, errors: ["not_generated"] as string[] };
    let usedModel = model;
    let attempts = 0;

    for (attempts = 1; attempts <= 2; attempts++) {
      const out = await chatCompletion(model, messagesPayload, {
        temperature: attempts === 1 ? 0.6 : 0.2,
        max_tokens: 120,
      });
      if (!out) continue;
      usedModel = out.usedModel;
      const finalized = finalizeReply(out.content, name);
      reply = finalized.text;
      validation = { ok: finalized.ok, errors: finalized.errors };
      if (finalized.ok) break;
    }

    if (!reply) {
      console.error("generate-reply: no content from OpenRouter");
      return new Response(JSON.stringify({ error: "llm_failed" }), { status: 502, headers: corsHeaders });
    }

    // Layer 3: sanitizer — even if the model ignored both prior layers,
    // scrub any demo URL from the output.
    let sanitized = false;
    if (!demoAllowed) {
      const before = reply;
      reply = stripDemoUrls(reply);
      sanitized = before !== reply;
    }

    return new Response(JSON.stringify({
      reply,
      demo_url: usableDemoUrl,
      demo_link_locked: !demoAllowed,
      sanitizer_fired: sanitized,
      model: usedModel,
      sender_name: name || DEFAULT_SENDER_NAME,
      valid: validation.ok,
      needs_review: !validation.ok,
      validation_errors: validation.errors,
      attempts,
      node_prompt_used: !!nodePromptRow,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("inbox-generate-reply error:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: corsHeaders });
  }
});
