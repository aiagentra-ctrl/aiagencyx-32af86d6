// Resumes paused_hot_lead enrollments and clears the hot lead flag.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { prospect_id, clear_hot_lead } = await req.json();
    if (!prospect_id) return new Response(JSON.stringify({ error: "prospect_id required" }), { status: 400, headers: cors });
    await supabase.from("follow_up_enrollments").update({ status: "active", next_step_at: new Date().toISOString() })
      .eq("prospect_id", prospect_id).eq("status", "paused_hot_lead");
    if (clear_hot_lead) {
      await supabase.from("prospects").update({ is_hot_lead: false, hot_lead_open_count: 0 }).eq("id", prospect_id);
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), { status: 500, headers: cors });
  }
});