// Computes analytics for a sequence template: funnel, reply quality, heatmap, A/B, smart timing usage.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { sequence_template_id } = await req.json();
    if (!sequence_template_id) return new Response(JSON.stringify({ error: "sequence_template_id required" }), { status: 400, headers: cors });

    const [enrRes, stepsRes] = await Promise.all([
      supabase.from("follow_up_enrollments").select("*, prospects(firstname,email,company,last_classification)").eq("sequence_template_id", sequence_template_id),
      supabase.from("follow_up_steps").select("*").eq("sequence_template_id", sequence_template_id).order("step_number"),
    ]);
    const enrollments = enrRes.data || [];
    const steps = stepsRes.data || [];
    const totalSteps = steps.length || 1;

    // Stats
    const enrolled = enrollments.length;
    const active = enrollments.filter((e: any) => e.status === "active").length;
    const completed = enrollments.filter((e: any) => e.status === "completed").length;
    const responded = enrollments.filter((e: any) => !!e.replied_at || e.status === "responded").length;
    const responseRate = enrolled ? Math.round((responded / enrolled) * 100) : 0;
    const repliedSteps = enrollments.filter((e: any) => e.replied_at).map((e: any) => e.current_step || 1);
    const avgStepToReply = repliedSteps.length ? +(repliedSteps.reduce((a: number, b: number) => a + b, 0) / repliedSteps.length).toFixed(1) : 0;

    // Funnel: for each step_number, count enrollments that reached (current_step >= n OR replied_at) and those that replied at that step
    const funnel = steps.map((s: any) => {
      const reached = enrollments.filter((e: any) => (e.current_step ?? 0) >= s.step_number).length;
      const repliedHere = enrollments.filter((e: any) => e.replied_at && (e.current_step ?? 0) === s.step_number).length;
      const rate = reached ? Math.round((repliedHere / reached) * 100) : 0;
      return { step_number: s.step_number, reached, replied: repliedHere, reply_rate: rate };
    });
    const bestStep = funnel.slice().sort((a, b) => b.reply_rate - a.reply_rate)[0] || null;

    // Reply quality from prospects.last_classification
    const cls = { positive: 0, negative: 0, objection: 0 };
    for (const e of enrollments) {
      const c = (e.prospects as any)?.last_classification || e.reply_classification;
      if (!e.replied_at && e.status !== "responded") continue;
      if (c === "positive") cls.positive++;
      else if (c === "negative") cls.negative++;
      else if (c === "objection") cls.objection++;
    }

    // Heatmap: for prospects in this sequence, reply events by day/hour
    const prospectIds = enrollments.map((e: any) => e.prospect_id);
    let heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    let totalReplyEvents = 0;
    if (prospectIds.length) {
      const { data: acts } = await supabase.from("prospect_activity_times").select("day_of_week,hour_of_day").eq("event_type", "reply").in("prospect_id", prospectIds);
      for (const a of acts || []) { heatmap[a.day_of_week][a.hour_of_day]++; totalReplyEvents++; }
    }

    // Smart timing usage
    const withSmart = enrollments.filter((e: any) => e.best_send_hour != null).length;
    const withoutSmart = enrollments.length - withSmart;

    // A/B split (by assigned_variant)
    const ab: any = { A: null, B: null };
    for (const variant of ["A", "B"]) {
      const en = enrollments.filter((e: any) => e.assigned_variant === variant);
      if (!en.length) continue;
      const rep = en.filter((e: any) => !!e.replied_at || e.status === "responded").length;
      ab[variant] = { enrolled: en.length, responded: rep, response_rate: en.length ? Math.round(rep / en.length * 100) : 0 };
    }

    return new Response(JSON.stringify({
      stats: { enrolled, active, completed, responded, responseRate, avgStepToReply },
      funnel, bestStep, reply_quality: cls, heatmap, totalReplyEvents,
      smart_timing: { with_smart: withSmart, without_smart: withoutSmart },
      ab, steps,
      prospects_by_step: funnel.map((f) => ({
        step_number: f.step_number,
        prospects: enrollments.filter((e: any) => (e.current_step ?? 0) === f.step_number).map((e: any) => ({
          id: e.prospect_id,
          name: e.prospects?.firstname || e.prospects?.email,
          company: e.prospects?.company,
          status: e.status,
          replied_at: e.replied_at,
        })),
      })),
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), { status: 500, headers: cors });
  }
});