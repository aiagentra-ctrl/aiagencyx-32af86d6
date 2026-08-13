// Retry a failed/partial demo job. Completed steps are reused (create-demo
// checks them), so only unfinished work runs again.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { job_id } = await req.json().catch(() => ({}));
    if (!job_id) return json({ error: "job_id is required" }, 400);

    const { data: job } = await sb.from("demo_jobs").select("*").eq("id", job_id).maybeSingle();
    if (!job) return json({ error: "job not found" }, 404);
    if (job.status === "running") return json({ error: "job is already running" }, 409);

    // Reset only the steps that are not completed/skipped.
    const { data: steps } = await sb.from("demo_job_steps").select("id, step, status").eq("job_id", job_id);
    const unfinished = (steps ?? []).filter((s: any) => !["completed", "skipped"].includes(s.status));
    if (unfinished.length) {
      await sb.from("demo_job_steps")
        .update({ status: "pending", error: null, updated_at: new Date().toISOString() })
        .in("id", unfinished.map((s: any) => s.id));
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/create-demo`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({
        job_id,
        business_name: job.business_name,
        website_url: job.website_url,
        email: job.email,
        prospect_id: job.prospect_id,
      }),
    });
    const text = await res.text();
    let out: any = null;
    try { out = JSON.parse(text); } catch { out = text; }

    return json({
      job_id,
      retried_steps: unfinished.map((s: any) => s.step),
      ok: res.ok,
      status: res.status,
      result: out,
    }, res.ok ? 200 : 502);
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
