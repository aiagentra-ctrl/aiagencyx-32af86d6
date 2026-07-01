// Generates a follow-up message body for a given prospect + trigger key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildProspectVars, substituteVars, FOLLOWUP_PROMPTS, type TriggerKey } from "../_shared/followup.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

async function callAi(system: string, user: string): Promise<string> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  const j = await r.json();
  return j?.choices?.[0]?.message?.content?.trim() || "";
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

    const { data: rule } = await supabase.from("followup_rules").select("prompt_override").eq("trigger_key", trigger_key).maybeSingle();
    const rawPrompt = (rule?.prompt_override && rule.prompt_override.trim()) || FOLLOWUP_PROMPTS[trigger_key as TriggerKey] || FOLLOWUP_PROMPTS.no_click_48h;
    const system = substituteVars(rawPrompt, vars);

    const userCtx = `Prospect: ${p.firstname || ""} at ${p.company || ""} (${p.email}). Demo URL: ${demo?.demo_url || "n/a"}. Behavior: clicked=${!!p.demo_link_clicked_at}, opened=${!!p.demo_page_opened_at}, tried_voice=${!!p.voice_tried_at}, tried_chat=${!!p.chatbot_tried_at}. Write only the email body, no preamble.`;
    const reply = await callAi(system, userCtx);
    return new Response(JSON.stringify({ reply, subject: `Re: ${p.firstname || "there"} overview`, demo_url: demo?.demo_url || null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});