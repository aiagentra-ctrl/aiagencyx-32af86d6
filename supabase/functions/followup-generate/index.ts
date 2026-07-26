// Generates a follow-up message body for a given prospect + trigger key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildProspectVars, substituteVars, FOLLOWUP_PROMPTS, type TriggerKey } from "../_shared/followup.ts";
import { chatCompletion, MODELS } from "../_shared/openrouter.ts";
import { finalizeReply, senderName } from "../_shared/reply-format.ts";
import { getOrCreateMemory, memoryPromptBlock } from "../_shared/memory.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function callAi(system: string, user: string, temperature = 0.5): Promise<string> {
  const out = await chatCompletion(
    MODELS.agent,
    [{ role: "system", content: system }, { role: "user", content: user }],
    { temperature, max_tokens: 120 },
  );
  return (out?.content || "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { prospect_id, trigger_key } = await req.json();
    if (!prospect_id || !trigger_key) return new Response(JSON.stringify({ error: "prospect_id and trigger_key required" }), { status: 400, headers: corsHeaders });

    const { data: p } = await supabase.from("prospects").select("*").eq("id", prospect_id).single();
    if (!p) return new Response(JSON.stringify({ error: "prospect not found" }), { status: 404, headers: corsHeaders });
    const { data: demo } = await supabase.from("inbox_demos").select("demo_url").eq("prospect_id", prospect_id).order("created_at", { ascending: false }).limit(1).maybeSingle();

    const vars = buildProspectVars(p, demo?.demo_url);
    const name = senderName(p);
    const memory = await getOrCreateMemory(prospect_id).catch(() => null);

    const { data: rule } = await supabase.from("followup_rules").select("prompt_override").eq("trigger_key", trigger_key).maybeSingle();
    const rawPrompt = (rule?.prompt_override && rule.prompt_override.trim()) || FOLLOWUP_PROMPTS[trigger_key as TriggerKey] || FOLLOWUP_PROMPTS.no_click_48h;
    let system = substituteVars(rawPrompt, vars);
    system += memoryPromptBlock(memory as any);
    system += `\n\nOUTPUT FORMAT (STRICT): max two short sentences, no markdown links, no brackets. If a link is included put the raw URL on its own line. End with exactly:\nBest,\n${name}`;

    const userCtx = `Prospect: ${p.firstname || ""} at ${p.company || ""} (${p.email}). Demo URL: ${demo?.demo_url || "n/a"}. Behavior: clicked=${!!p.demo_link_clicked_at}, opened=${!!p.demo_page_opened_at}, tried_voice=${!!p.voice_tried_at}, tried_chat=${!!p.chatbot_tried_at}. Write only the email body, no preamble.`;

    let finalized = finalizeReply(await callAi(system, userCtx), name);
    if (!finalized.ok) finalized = finalizeReply(await callAi(system, userCtx, 0.2), name);

    return new Response(JSON.stringify({
      reply: finalized.text,
      subject: `Re: ${p.firstname || "there"} overview`,
      demo_url: demo?.demo_url || null,
      sender_name: name,
      valid: finalized.ok,
      needs_review: !finalized.ok,
      validation_errors: finalized.errors,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});