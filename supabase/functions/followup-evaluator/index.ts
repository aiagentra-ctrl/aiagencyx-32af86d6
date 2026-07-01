// Rule-based evaluator. Scans prospects and inserts pending followup_events
// when behavioral state matches a rule and cooldown/attempt guards pass.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function hoursAgo(iso?: string | null): number {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 3600_000;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { data: rules } = await supabase.from("followup_rules").select("*").eq("enabled", true);
    const rulesByKey = new Map((rules || []).map((r: any) => [r.trigger_key, r]));

    // Only consider real (non-test) prospects with a demo sent & not paused & not already responded
    const { data: prospects } = await supabase
      .from("prospects")
      .select("*")
      .eq("is_test_data", false)
      .neq("followup_status", "responded")
      .neq("followup_status", "paused")
      .not("demo_sent_at", "is", null)
      .limit(500);

    let created = 0;
    for (const p of prospects || []) {
      if (p.automation_paused) continue;
      if ((p.followup_attempts ?? 0) >= (p.max_followup_attempts ?? 2)) continue;

      // pick trigger
      const triedVoice = !!p.voice_tried_at;
      const triedChat = !!p.chatbot_tried_at;
      const opened = !!p.demo_page_opened_at;
      const clicked = !!p.demo_link_clicked_at;
      const demoAge = hoursAgo(p.demo_sent_at);

      let triggerKey: string | null = null;
      if (triedVoice && triedChat && hoursAgo(p.last_activity_at) >= (rulesByKey.get("tried_both_no_reply")?.delay_hours ?? 72)) triggerKey = "tried_both_no_reply";
      else if (triedVoice && !triedChat && hoursAgo(p.voice_tried_at) >= (rulesByKey.get("tried_voice_only")?.delay_hours ?? 48)) triggerKey = "tried_voice_only";
      else if (triedChat && !triedVoice && hoursAgo(p.chatbot_tried_at) >= (rulesByKey.get("tried_chat_only")?.delay_hours ?? 48)) triggerKey = "tried_chat_only";
      else if (opened && !triedVoice && !triedChat && hoursAgo(p.demo_page_opened_at) >= (rulesByKey.get("opened_no_try")?.delay_hours ?? 24)) triggerKey = "opened_no_try";
      else if (clicked && !opened && hoursAgo(p.demo_link_clicked_at) >= (rulesByKey.get("clicked_no_open")?.delay_hours ?? 24)) triggerKey = "clicked_no_open";
      else if (!clicked && demoAge >= (rulesByKey.get("no_click_48h")?.delay_hours ?? 48)) triggerKey = "no_click_48h";

      if (!triggerKey) continue;
      if (!rulesByKey.has(triggerKey)) continue;

      // Skip if a pending event already exists for this prospect
      const { data: existing } = await supabase
        .from("followup_events").select("id").eq("prospect_id", p.id)
        .in("status", ["pending"]).limit(1);
      if (existing && existing.length) continue;

      await supabase.from("followup_events").insert({
        prospect_id: p.id,
        trigger_key: triggerKey,
        status: "pending",
        scheduled_at: new Date().toISOString(),
        attempt: (p.followup_attempts ?? 0) + 1,
        source: "rule",
      });
      await supabase.from("prospects").update({
        followup_status: "scheduled",
        next_followup_at: new Date().toISOString(),
        next_followup_trigger: triggerKey,
      }).eq("id", p.id);
      created++;
    }

    return new Response(JSON.stringify({ ok: true, created }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});