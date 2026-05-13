import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const TRIGGER_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/trigger-follow-up`;

async function sendOne(row: any) {
  // Re-fetch lead and re-validate
  const { data: lead } = await supabase.from("demo_leads").select("*").eq("id", row.lead_id).maybeSingle();
  if (!lead) {
    return { status: "cancelled", reason: "lead_missing" };
  }

  // Validate per-case state
  if (row.type === "case1") {
    if (lead.tried_voice || lead.tried_chat) {
      // user engaged → cancel case1, schedule case2 if not done
      if (!lead.followup_case2_sent) {
        const delay = await getDelay("case2_delay_hours", 1);
        const earliest = lead.voice_first_at || lead.chat_first_at || new Date().toISOString();
        const scheduled = new Date(new Date(earliest).getTime() + delay * 3600_000);
        await supabase.from("email_queue").insert({
          lead_id: lead.id, type: "case2", scheduled_at: scheduled.toISOString(),
        });
      }
      return { status: "cancelled", reason: "switched_to_case2" };
    }
    if (lead.followup_case1_sent) return { status: "cancelled", reason: "already_sent" };
  } else if (row.type === "case2") {
    if (!(lead.tried_voice || lead.tried_chat)) return { status: "cancelled", reason: "no_engagement" };
    if (lead.followup_case2_sent) return { status: "cancelled", reason: "already_sent" };
  }

  // Send via trigger-follow-up (it handles ManyReach + logging)
  const res = await fetch(TRIGGER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify({ lead_id: lead.id, case: row.type }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) {
    return { status: "failed", reason: json?.error || `http_${res.status}` };
  }

  // Flip the lead flag
  const flagPatch: any = {};
  if (row.type === "case1") flagPatch.followup_case1_sent = true;
  if (row.type === "case2") { flagPatch.followup_case2_sent = true; flagPatch.feedback_requested = true; }
  await supabase.from("demo_leads").update(flagPatch).eq("id", lead.id);
  return { status: "sent" };
}

async function getDelay(key: string, fallback: number): Promise<number> {
  const { data } = await supabase.from("followup_settings").select("value").eq("key", key).maybeSingle();
  const v = parseFloat(data?.value || "");
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { data: pending } = await supabase
      .from("email_queue")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .limit(50);

    const results: any[] = [];
    for (const row of pending || []) {
      try {
        const r = await sendOne(row);
        const update: any = { status: r.status, updated_at: new Date().toISOString() };
        if (r.status === "sent") update.sent_at = new Date().toISOString();
        if (r.status !== "sent") update.cancelled_reason = (r as any).reason;
        await supabase.from("email_queue").update(update).eq("id", row.id);
        results.push({ id: row.id, ...r });
      } catch (e) {
        await supabase.from("email_queue").update({
          status: "failed",
          cancelled_reason: e instanceof Error ? e.message : "error",
          updated_at: new Date().toISOString(),
        }).eq("id", row.id);
        results.push({ id: row.id, status: "failed", error: String(e) });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
