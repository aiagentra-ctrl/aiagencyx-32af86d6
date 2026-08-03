// Sequence engine: processes due enrollments, substitutes variables, sends
// current step via ManyReach, and advances the enrollment.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildProspectVars, renderStepBody } from "../_shared/followup.ts";
import { sendReply, extractMessageId } from "../_shared/manyreach.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function unitToHours(unit: string): number {
  if (unit === "weeks") return 24 * 7;
  if (unit === "hours") return 1;
  return 24; // days
}

// Shift a scheduled time forward to next best_day @ best_hour, cap at +48h beyond raw
function smartTime(rawIso: string, bestDay: number | null, bestHour: number | null): { iso: string; used: boolean } {
  const raw = new Date(rawIso);
  if (bestDay == null || bestHour == null) return { iso: rawIso, used: false };
  const d = new Date(raw);
  d.setUTCHours(bestHour, 0, 0, 0);
  // advance to next matching day-of-week that is >= raw
  for (let i = 0; i < 8; i++) {
    if (d.getUTCDay() === bestDay && d.getTime() >= raw.getTime()) break;
    d.setUTCDate(d.getUTCDate() + 1);
    d.setUTCHours(bestHour, 0, 0, 0);
  }
  const cap = new Date(raw.getTime() + 48 * 3600_000);
  if (d.getTime() > cap.getTime()) return { iso: rawIso, used: false };
  return { iso: d.toISOString(), used: true };
}

async function loadFallbacks(): Promise<Record<string, string>> {
  const { data } = await supabase.from("variable_fallbacks").select("variable_key, fallback_value");
  const map: Record<string, string> = {};
  for (const r of data || []) map[(r as any).variable_key] = (r as any).fallback_value || "";
  return map;
}

function substituteWithFallbacks(tpl: string, vars: Record<string, string>, fallbacks: Record<string, string>): string {
  return (tpl || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => {
    const v = vars[k];
    if (v && v.trim() && v.toLowerCase() !== "unknown") return v;
    return fallbacks[k] ?? "";
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const nowIso = new Date().toISOString();
    const { data: due } = await supabase
      .from("follow_up_enrollments")
      .select("*")
      .eq("status", "active")
      .lte("next_step_at", nowIso)
      .limit(50);

    let sent = 0, cancelled = 0, failed = 0;
    const fallbacks = await loadFallbacks();

    for (const enr of due || []) {
      // Claim the enrollment so a slow run can't be picked up twice by the
      // next cron tick (duplicate-send protection).
      const { data: claimed } = await supabase
        .from("follow_up_enrollments")
        .update({ status: "sending" })
        .eq("id", enr.id)
        .eq("status", "active")
        .select("id")
        .maybeSingle();
      if (!claimed) continue; // another run already took it

      const release = async (patch: Record<string, any>) => {
        if (!patch.status) patch.status = "active";
        await supabase.from("follow_up_enrollments").update(patch).eq("id", enr.id);
      };

      const lagMs = Date.now() - new Date(enr.next_step_at).getTime();

      const { data: p } = await supabase.from("prospects").select("*").eq("id", enr.prospect_id).single();
      if (!p) { await release({}); continue; }
      if (p.automation_paused) { await release({}); continue; }

      // ── Hard exit 1: prospect replied at ANY point (any step, any sequence).
      // Once a lead replies — positive or negative — every future follow-up stops.
      const { data: reply } = await supabase.from("inbox_messages").select("id").eq("prospect_id", p.id).eq("direction", "incoming").limit(1);
      if (reply && reply.length) {
        await release({ status: "responded", completed_at: nowIso });
        cancelled++; continue;
      }

      // ── Hard exit 2: prospect booked a call on Calendly
      if (p.calendly_booked_at) {
        await release({ status: "booked", completed_at: nowIso });
        cancelled++; continue;
      }

      // Check template active
      const { data: seq } = await supabase.from("follow_up_sequences_templates").select("*").eq("id", enr.sequence_template_id).maybeSingle();
      if (!seq || !seq.is_active) {
        await release({ status: "cancelled", completed_at: nowIso });
        cancelled++; continue;
      }

      // ── Hard exit 3: sequence cap reached
      const cap = Number(seq.max_steps ?? 3);
      if (Number.isFinite(cap) && cap > 0 && enr.current_step > cap) {
        await release({ status: "completed", completed_at: nowIso, next_step_at: null });
        continue;
      }


      const { data: steps } = await supabase.from("follow_up_steps").select("*").eq("sequence_template_id", enr.sequence_template_id).order("step_number", { ascending: true });
      const step = (steps || []).find((s: any) => s.step_number === enr.current_step);
      if (!step) {
        await release({ status: "completed", completed_at: nowIso });
        continue;
      }

      const { data: demo } = await supabase.from("inbox_demos").select("demo_url").eq("prospect_id", p.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const vars = buildProspectVars(p, demo?.demo_url);
      // Open editor: the step body is free text — send exactly what the operator wrote.
      const rawBody = substituteWithFallbacks(step.message_body, vars, fallbacks);
      let body = renderStepBody(rawBody);

      const subject = substituteWithFallbacks(step.message_subject || "Re: {{firstname}} overview", vars, fallbacks);

      if (!p.original_message_id) {
        await release({ status: "failed", last_error: "no original_message_id" });
        failed++; continue;
      }

      const payload = {
        messageId: p.original_message_id, subject, body,
        fromEmail: p.sender_email, replyToEmail: p.email,
      };
      const res = await sendReply(payload);
      const rj: any = res.data ?? {};

      if (!res.ok) {
        const retry = (enr.retry_count ?? 0) + 1;
        const patch: any = { retry_count: retry, last_error: res.error, status: "active" };
        if (retry >= 3) { patch.status = "failed"; patch.completed_at = nowIso; }
        else { patch.next_step_at = new Date(Date.now() + 30 * 60_000).toISOString(); }
        await release(patch);
        failed++; continue;
      }

      await supabase.from("inbox_messages").insert({
        prospect_id: p.id, direction: "outgoing", source: "followup_sequence",
        subject, body, manyreach_message_id: extractMessageId(rj),
      });
      await supabase.from("followup_events").insert({
        prospect_id: p.id, trigger_key: "sequence", status: "sent", sent_at: nowIso,
        message_subject: subject, message_body: body, source: "sequence",
        sequence_enrollment_id: enr.id, attempt: enr.current_step,
        manyreach_message_id: extractMessageId(rj),
      });

      // Advance
      const nextStep = (steps || []).find((s: any) => s.step_number === enr.current_step + 1);
      if (!nextStep) {
        await release({ status: "completed", completed_at: nowIso, next_step_at: null });
      } else {
        const rawIso = new Date(Date.now() + nextStep.delay_value * unitToHours(nextStep.delay_unit) * 3600_000).toISOString();
        // Smart send time
        const { data: bst } = await supabase.rpc("get_best_send_time", { p_prospect_id: p.id });
        const row: any = (bst || [])[0];
        const enough = row && Number(row.data_points || 0) >= 3;
        const shifted = enough ? smartTime(rawIso, row.best_day, row.best_hour) : { iso: rawIso, used: false };
        await release({
          status: "active",
          current_step: enr.current_step + 1,
          next_step_at: shifted.iso,
          retry_count: 0,
          best_send_hour: shifted.used ? row.best_hour : null,
          best_send_day: shifted.used ? row.best_day : null,
          scheduling_debug: {
            sent_step: enr.current_step,
            sent_at: nowIso,
            step_number: enr.current_step,
            lag_ms: lagMs,
            was_overdue: lagMs > 15 * 60_000,
            raw_next_at: rawIso,
            shifted_next_at: shifted.iso,
            smart_shift_applied: shifted.used,
            manyreach_attempts: res.attempts,
            manyreach_ms: res.ms,
          },
        });
      }
      sent++;
    }

    await supabase.from("activity_logs").insert({
      event_type: "sequence_processor_run",
      status: sent > 0 ? "sent" : "idle",
      message: `sequence: considered ${due?.length ?? 0}, sent ${sent}, cancelled ${cancelled}, failed ${failed}`,
      metadata: { considered: due?.length ?? 0, sent, cancelled, failed },
    });
    return new Response(JSON.stringify({ ok: true, sent, cancelled, failed, considered: due?.length ?? 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), { status: 500, headers: corsHeaders });
  }
});