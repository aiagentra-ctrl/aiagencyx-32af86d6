// Public webhook for ManyReach reply events.
// Protected by a shared secret query param: ?key=<INBOX_WEBHOOK_SECRET>
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logWebhook, traceStep, logError } from "../_shared/observability.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const WEBHOOK_SECRET = Deno.env.get("INBOX_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function pick<T = string>(obj: any, ...keys: string[]): T | undefined {
  for (const k of keys) {
    const parts = k.split(".");
    let cur = obj;
    for (const p of parts) cur = cur?.[p];
    if (cur !== undefined && cur !== null && cur !== "") return cur as T;
  }
  return undefined;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const t0 = Date.now();
  let payload: any = {};
  let prospectId: string | null = null;
  let messageId: string | null = null;
  const finalize = async (status: "success" | "failed", code: number, response: unknown, error?: string) => {
    await logWebhook({
      endpoint: "webhook-manyreach-reply",
      method: "POST",
      status, status_code: code,
      response_ms: Date.now() - t0,
      payload, response, error: error ?? null,
      source: "manyreach",
    });
  };

  try {
    const url = new URL(req.url);
    // Accept the secret under any of these names so existing wiring
    // (?key=) AND new ManyReach wiring (?secret=) both work.
    const key = url.searchParams.get("key")
      || url.searchParams.get("secret")
      || req.headers.get("x-webhook-key");
    if (!WEBHOOK_SECRET || key !== WEBHOOK_SECRET) {
      const r = { error: "unauthorized" };
      await finalize("failed", 401, r, "unauthorized");
      return new Response(JSON.stringify(r), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    payload = await req.json().catch(() => ({}));

    // ManyReach payloads can arrive either flat or nested under `body`
    // (as shown in the n8n workflow — body.prospect.*, body.message, etc.)
    const root: any = payload?.body && typeof payload.body === "object" ? payload.body : payload;
    const email = pick<string>(root, "prospect.email", "email", "from", "fromEmail", "sender", "data.email");
    const body = pick<string>(root, "message", "body", "text", "reply", "data.body", "data.message") || "";
    const subject = pick<string>(root, "subject", "data.subject") || "";
    const manyMessageId = pick<string>(root, "messageId", "message_id", "id", "data.messageId");
    const firstname = pick<string>(root, "prospect.firstname", "prospect.firstName", "firstname", "firstName", "first_name", "data.firstName");
    const company = pick<string>(root, "prospect.company", "company", "data.company");
    const website = pick<string>(root, "prospect.www", "prospect.website", "website", "website_url", "data.website");
    const campaignId = pick<string>(root, "campaign.campaignID", "campaignId", "campaign_id", "data.campaignId");
    const campaignName = pick<string>(root, "campaign.campaignTitle", "campaignName", "campaign_name", "data.campaignName");
    const senderEmail = pick<string>(root, "sender_email", "senderEmail", "fromAccount", "data.senderEmail");
    const replyToEmail = pick<string>(root, "replyToEmail", "reply_to", "data.replyToEmail") || senderEmail;

    // Mark health-check / test traffic so it doesn't pollute the real inbox.
    const isTest = !!email && /^healthcheck-test@|@example\.com$/i.test(email);

    if (!email) {
      const r = { error: "missing email", payload };
      await finalize("failed", 400, r, "missing email");
      return new Response(JSON.stringify(r), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Upsert prospect by email
    const { data: existing } = await supabase
      .from("prospects").select("*").eq("email", email).maybeSingle();

    if (existing) {
      prospectId = existing.id;
      const update: Record<string, any> = { last_message_at: new Date().toISOString() };
      if (!existing.firstname && firstname) update.firstname = firstname;
      if (!existing.company && company) update.company = company;
      if (!existing.website_url && website) update.website_url = website;
      if (!existing.campaign_id && campaignId) update.campaign_id = campaignId;
      if (!existing.campaign_name && campaignName) update.campaign_name = campaignName;
      if (!existing.sender_email && senderEmail) update.sender_email = senderEmail;
      if (!existing.reply_to_email && replyToEmail) update.reply_to_email = replyToEmail;
      if (!existing.original_message_id && manyMessageId) update.original_message_id = manyMessageId;
      update.last_activity_at = new Date().toISOString();
      // Prospect replied → cancel any pending follow-ups & mark responded
      if (existing.followup_status && existing.followup_status !== 'none') {
        update.followup_status = 'responded';
      }
      await supabase.from("prospects").update(update).eq("id", prospectId);
      // Cancel pending followup_events and mark active enrollments responded
      await supabase.from("followup_events").update({ status: 'cancelled' }).eq("prospect_id", prospectId).eq("status", "pending");
      await supabase.from("follow_up_enrollments").update({ status: 'responded', completed_at: new Date().toISOString() }).eq("prospect_id", prospectId).eq("status", "active");
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from("prospects").insert({
          email, firstname, company, website_url: website,
          campaign_id: campaignId, campaign_name: campaignName,
          sender_email: senderEmail, reply_to_email: replyToEmail,
          last_message_at: new Date().toISOString(),
          original_message_id: manyMessageId,
          last_activity_at: new Date().toISOString(),
          is_test_data: isTest,
        }).select("id").single();
      if (insErr) throw insErr;
      prospectId = inserted.id;
    }

    // Insert incoming message
    const { data: msg, error: msgErr } = await supabase
      .from("inbox_messages").insert({
        prospect_id: prospectId,
        manyreach_message_id: manyMessageId,
        direction: "incoming",
        source: "email",
        subject,
        body,
        is_test_data: isTest,
      }).select("id").single();
    if (msgErr) throw msgErr;
    messageId = msg.id;

    await traceStep(prospectId, messageId, "webhook_received", "ok", {
      email, subject, has_body: !!body, manyreach_message_id: manyMessageId,
    });
    await traceStep(prospectId, messageId, "stored", "ok", { message_id: messageId });

    // Fire-and-forget orchestrator
    fetch(`${SUPABASE_URL}/functions/v1/inbox-process-incoming`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ prospect_id: prospectId, message_id: messageId }),
    }).catch((e) => console.error("orchestrator dispatch failed:", e));

    const r = { ok: true, prospect_id: prospectId, message_id: messageId };
    await finalize("success", 200, r);
    return new Response(JSON.stringify(r), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("webhook-manyreach-reply error:", e);
    const msg = String((e as any)?.message || e);
    const stack = (e as any)?.stack || null;
    await finalize("failed", 500, { error: msg }, msg);
    await logError("webhook", msg, { prospect_id: prospectId, message_id: messageId, stack });
    await traceStep(prospectId, messageId, "webhook_received", "failed", null, msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
