// Dispatcher: picks up pending followup_events whose scheduled_at <= now(),
// and if auto_send is enabled for the rule, sends via followup-send.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const nowIso = new Date().toISOString();
    const { data: events } = await supabase.from("followup_events").select("*, prospects!inner(automation_paused)").eq("status", "pending").lte("scheduled_at", nowIso).limit(50);
    const { data: rules } = await supabase.from("followup_rules").select("trigger_key, auto_send");
    const auto = new Map((rules || []).map((r: any) => [r.trigger_key, r.auto_send]));
    let sent = 0, skipped = 0;
    for (const ev of events || []) {
      if ((ev as any).prospects?.automation_paused) { skipped++; continue; }
      if (!auto.get(ev.trigger_key)) { skipped++; continue; }
      const r = await fetch(`${SUPABASE_URL}/functions/v1/followup-send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({ event_id: ev.id }),
      });
      if (r.ok) sent++;
    }
    await supabase.from("activity_logs").insert({
      event_type: "followup_dispatcher_run",
      status: sent > 0 ? "sent" : "idle",
      message: `dispatcher: considered ${events?.length ?? 0}, sent ${sent}, skipped ${skipped}`,
      metadata: { considered: events?.length ?? 0, sent, skipped },
    });
    return new Response(JSON.stringify({ ok: true, sent, skipped, considered: events?.length ?? 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), { status: 500, headers: corsHeaders });
  }
});