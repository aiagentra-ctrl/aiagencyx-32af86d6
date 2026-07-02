// Sequence engine: processes due enrollments, substitutes variables, sends
// current step via ManyReach, and advances the enrollment.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildProspectVars, substituteVars } from "../_shared/followup.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const MANYREACH_API_KEY = Deno.env.get("MANYREACH_API_KEY")!;
const MANYREACH_URL = "https://api.manyreach.com/api/v2/messages/reply";

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
      const { data: p } = await supabase.from("prospects").select("*").eq("id", enr.prospect_id).single();
      if (!p) continue;
      if (p.automation_paused) continue;

      // Cancel if prospect replied after start
      const { data: reply } = await supabase.from("inbox_messages").select("id").eq("prospect_id", p.id).eq("direction", "incoming").gt("created_at", enr.started_at).limit(1);
      if (reply && reply.length) {
        await supabase.from("follow_up_enrollments").update({ status: "responded", completed_at: nowIso }).eq("id", enr.id);
        cancelled++; continue;
      }

      // Check template active
      const { data: seq } = await supabase.from("follow_up_sequences_templates").select("*").eq("id", enr.sequence_template_id).maybeSingle();
      if (!seq || !seq.is_active) {
        await supabase.from("follow_up_enrollments").update({ status: "cancelled", completed_at: nowIso }).eq("id", enr.id);
        cancelled++; continue;
      }

      const { data: steps } = await supabase.from("follow_up_steps").select("*").eq("sequence_template_id", enr.sequence_template_id).order("step_number", { ascending: true });
      const step = (steps || []).find((s: any) => s.step_number === enr.current_step);
      if (!step) {
        await supabase.from("follow_up_enrollments").update({ status: "completed", completed_at: nowIso }).eq("id", enr.id);
        continue;
      }

      const { data: demo } = await supabase.from("inbox_demos").select("demo_url").eq("prospect_id", p.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const vars = buildProspectVars(p, demo?.demo_url);
      let body = substituteWithFallbacks(step.message_body, vars, fallbacks);
      const subject = substituteWithFallbacks(step.message_subject || "Re: {{firstname}} overview", vars, fallbacks);
      if (!step.include_demo_link) body = body.replace(/\{\{\s*demo_url\s*\}\}/g, "").replace(demo?.demo_url || "___", "");

      if (!p.original_message_id) {
        await supabase.from("follow_up_enrollments").update({ status: "failed", last_error: "no original_message_id" }).eq("id", enr.id);
        failed++; continue;
      }

      const payload = {
        messageId: p.original_message_id, subject, body,
        sendAsReply: "true", fromEmail: p.sender_email, replyToEmail: p.email,
      };
      const res = await fetch(MANYREACH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": MANYREACH_API_KEY },
        body: JSON.stringify(payload),
      });
      const rj: any = await res.json().catch(() => ({}));

      if (!res.ok) {
        const retry = (enr.retry_count ?? 0) + 1;
        const patch: any = { retry_count: retry, last_error: `HTTP ${res.status}` };
        if (retry >= 3) { patch.status = "failed"; patch.completed_at = nowIso; }
        else { patch.next_step_at = new Date(Date.now() + 30 * 60_000).toISOString(); }
        await supabase.from("follow_up_enrollments").update(patch).eq("id", enr.id);
        failed++; continue;
      }

      await supabase.from("inbox_messages").insert({
        prospect_id: p.id, direction: "outgoing", source: "followup_sequence",
        subject, body, manyreach_message_id: rj?.messageId || rj?.id || null,
      });
      await supabase.from("followup_events").insert({
        prospect_id: p.id, trigger_key: "sequence", status: "sent", sent_at: nowIso,
        message_subject: subject, message_body: body, source: "sequence",
        sequence_enrollment_id: enr.id, attempt: enr.current_step,
        manyreach_message_id: rj?.messageId || rj?.id || null,
      });

      // Advance
      const nextStep = (steps || []).find((s: any) => s.step_number === enr.current_step + 1);
      if (!nextStep) {
        await supabase.from("follow_up_enrollments").update({ status: "completed", completed_at: nowIso, next_step_at: null }).eq("id", enr.id);
      } else {
        const rawIso = new Date(Date.now() + nextStep.delay_value * unitToHours(nextStep.delay_unit) * 3600_000).toISOString();
        // Smart send time
        const { data: bst } = await supabase.rpc("get_best_send_time", { p_prospect_id: p.id });
        const row: any = (bst || [])[0];
        const enough = row && Number(row.data_points || 0) >= 3;
        const shifted = enough ? smartTime(rawIso, row.best_day, row.best_hour) : { iso: rawIso, used: false };
        await supabase.from("follow_up_enrollments").update({
          current_step: enr.current_step + 1,
          next_step_at: shifted.iso,
          retry_count: 0,
          best_send_hour: shifted.used ? row.best_hour : null,
          best_send_day: shifted.used ? row.best_day : null,
        }).eq("id", enr.id);
      }
      sent++;
    }

    return new Response(JSON.stringify({ ok: true, sent, cancelled, failed, considered: due?.length ?? 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), { status: 500, headers: corsHeaders });
  }
});