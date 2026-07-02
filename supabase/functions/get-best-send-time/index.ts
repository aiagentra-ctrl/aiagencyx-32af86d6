// Returns the best send hour/day for a prospect based on activity history.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { prospect_id } = await req.json();
    if (!prospect_id) return new Response(JSON.stringify({ error: "prospect_id required" }), { status: 400, headers: cors });
    const { data, error } = await supabase.rpc("get_best_send_time", { p_prospect_id: prospect_id });
    if (error) throw error;
    const row = (data || [])[0];
    const points = Number(row?.data_points ?? 0);
    if (!row || points < 3) return new Response(JSON.stringify({ best_day: null, best_hour: null, data_points: points }), { headers: { ...cors, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ best_day: row.best_day, best_hour: row.best_hour, data_points: points }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), { status: 500, headers: cors });
  }
});