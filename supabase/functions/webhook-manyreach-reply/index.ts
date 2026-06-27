// Public webhook for ManyReach reply events.
// Protected by a shared secret query param: ?key=<INBOX_WEBHOOK_SECRET>
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  try {
    const url = new URL(req.url);
    const key = url.searchParams.get("key") || req.headers.get("x-webhook-key");
    if (!WEBHOOK_SECRET || key !== WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json().catch(() => ({}));

    // ManyReach payloads vary; try common locations.
    const email = pick<string>(payload, "prospect.email", "email", "from", "fromEmail", "sender", "data.email");
    const body = pick<string>(payload, "body", "message", "text", "reply", "data.body", "data.message") || "";
    const subject = pick<string>(payload, "subject", "data.subject") || "";
    const messageId = pick<string>(payload, "messageId", "message_id", "id", "data.messageId");
    const firstname = pick<string>(payload, "prospect.firstName", "firstname", "firstName", "first_name", "data.firstName");
    const company = pick<string>(payload, "prospect.company", "company", "data.company");
    const website = pick<string>(payload, "prospect.website", "website", "website_url", "data.website");
    const campaignId = pick<string>(payload, "campaignId", "campaign_id", "data.campaignId");
    const campaignName = pick<string>(payload, "campaignName", "campaign_name", "data.campaignName");
    const senderEmail = pick<string>(payload, "senderEmail", "sender_email", "fromAccount", "data.senderEmail");
    const replyToEmail = pick<string>(payload, "replyToEmail", "reply_to", "data.replyToEmail") || senderEmail;

    if (!email) {
      return new Response(JSON.stringify({ error: "missing email", payload }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert prospect by email
    const { data: existing } = await supabase
      .from("prospects").select("*").eq("email", email).maybeSingle();

    let prospectId: string;
    if (existing) {
      prospectId = existing.id;
      // Only fill empty fields
      const update: Record<string, any> = { last_message_at: new Date().toISOString() };
      if (!existing.firstname && firstname) update.firstname = firstname;
      if (!existing.company && company) update.company = company;
      if (!existing.website_url && website) update.website_url = website;
      if (!existing.campaign_id && campaignId) update.campaign_id = campaignId;
      if (!existing.campaign_name && campaignName) update.campaign_name = campaignName;
      if (!existing.sender_email && senderEmail) update.sender_email = senderEmail;
      if (!existing.reply_to_email && replyToEmail) update.reply_to_email = replyToEmail;
      await supabase.from("prospects").update(update).eq("id", prospectId);
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from("prospects").insert({
          email, firstname, company, website_url: website,
          campaign_id: campaignId, campaign_name: campaignName,
          sender_email: senderEmail, reply_to_email: replyToEmail,
          last_message_at: new Date().toISOString(),
        }).select("id").single();
      if (insErr) throw insErr;
      prospectId = inserted.id;
    }

    // Insert incoming message
    const { data: msg, error: msgErr } = await supabase
      .from("inbox_messages").insert({
        prospect_id: prospectId,
        manyreach_message_id: messageId,
        direction: "incoming",
        source: "email",
        subject,
        body,
      }).select("id").single();
    if (msgErr) throw msgErr;

    // Fire-and-forget orchestrator
    fetch(`${SUPABASE_URL}/functions/v1/inbox-process-incoming`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ prospect_id: prospectId, message_id: msg.id }),
    }).catch((e) => console.error("orchestrator dispatch failed:", e));

    return new Response(JSON.stringify({ ok: true, prospect_id: prospectId, message_id: msg.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("webhook-manyreach-reply error:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
