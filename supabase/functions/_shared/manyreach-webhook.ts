// Shared ManyReach reply-webhook handler.
// Used by:
//   - webhook-manyreach-reply  (legacy long URL: ?key= / ?secret= / x-webhook-key)
//   - mr                       (short URL: /functions/v1/mr/<token>)
// Behaviour is identical for both; only how the secret arrives differs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logWebhook, traceStep, logError } from "./observability.ts";
import { recordReply } from "./memory.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const WEBHOOK_SECRET = Deno.env.get("INBOX_WEBHOOK_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Timing-safe string compare so the token can't be probed byte-by-byte. */
export function secretMatches(candidate: string | null | undefined): boolean {
  if (!WEBHOOK_SECRET || !candidate) return false;
  const a = new TextEncoder().encode(candidate);
  const b = new TextEncoder().encode(WEBHOOK_SECRET);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Fire a promise without blocking the response. */
function background(p: Promise<unknown>) {
  const runtime = (globalThis as any).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(p);
  else p.catch(() => {});
}

/** Stable hash used when a provider does not give us a message id. */
async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}

function pick<T = string>(obj: any, ...keys: string[]): T | undefined {

  for (const k of keys) {
    const parts = k.split(".");
    let cur = obj;
    for (const p of parts) cur = cur?.[p];
    if (cur !== undefined && cur !== null && cur !== "") return cur as T;
  }
  return undefined;
}

/**
 * Reads a webhook body regardless of content-type: JSON, form-encoded, or
 * raw text. Never throws — an unreadable body becomes an empty object.
 */
export async function readBody(req: Request): Promise<any> {
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  const raw = await req.text().catch(() => "");
  if (!raw) return {};
  if (ct.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(raw).entries());
  }
  if (ct.includes("multipart/form-data")) {
    try {
      const fd = await new Response(raw, { headers: { "content-type": ct } }).formData();
      return Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]));
    } catch { /* fall through */ }
  }
  try { return JSON.parse(raw); } catch { /* not json */ }
  // Last resort: a form-ish or plain-text body.
  if (raw.includes("=") && raw.includes("&")) {
    return Object.fromEntries(new URLSearchParams(raw).entries());
  }
  return { body: raw };
}

export async function handleManyreachWebhook(
  req: Request,
  opts: {
    endpoint: string;
    secretOverride?: string | null;
    /** Auth already established upstream (e.g. a registered webhook token). */
    preAuthorized?: boolean;
  } = { endpoint: "webhook-manyreach-reply" },
): Promise<Response> {
  const t0 = Date.now();
  let payload: any = {};
  let prospectId: string | null = null;
  let messageId: string | null = null;

  // Logging is non-blocking — it never adds latency to the webhook response.
  const finalize = (status: "success" | "failed", code: number, response: unknown, error?: string) => {
    background(logWebhook({
      endpoint: opts.endpoint,
      method: "POST",
      status, status_code: code,
      response_ms: Date.now() - t0,
      payload, response, error: error ?? null,
      source: "manyreach",
    }));
  };

  try {
    const url = new URL(req.url);

    if (!opts.preAuthorized) {
      const key = opts.secretOverride
        ?? url.searchParams.get("key")
        ?? url.searchParams.get("secret")
        ?? req.headers.get("x-webhook-key");

      if (!secretMatches(key)) {
        const r = { error: "unauthorized" };
        finalize("failed", 401, r, "unauthorized");
        return new Response(JSON.stringify(r), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    payload = await readBody(req);

    // Query params are merged in (some providers pass fields on the query string).
    const qs = Object.fromEntries(url.searchParams.entries());
    delete qs.key; delete qs.secret;
    if (Object.keys(qs).length && payload && typeof payload === "object" && !Array.isArray(payload)) {
      payload = { ...qs, ...payload };
    }

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

    const isTest = !!email && /^healthcheck-test@|@example\.com$/i.test(email);

    if (!email) {
      const r = { error: "missing email", payload };
      finalize("failed", 400, r, "missing email");
      return new Response(JSON.stringify(r), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Idempotency gate ───────────────────────────────────────────────
    // ManyReach fires several events (prospect_replied, prospect_interested…)
    // for the SAME reply, seconds apart. Without this gate each delivery runs
    // its own pipeline and the lead gets two demos and two replies.
    const dedupeKey = manyMessageId
      ? `mr:${manyMessageId}`
      : `mr:${email.toLowerCase()}:${await sha256Hex(`${subject}|${body}`.slice(0, 4000))}`;

    const { error: dedupeErr } = await supabase
      .from("webhook_dedupe").insert({ message_key: dedupeKey });

    if (dedupeErr) {
      // Row already exists -> this exact message was already ingested.

      const { data: prev } = await supabase
        .from("webhook_dedupe").select("prospect_id, inbox_message_id, seen_count")
        .eq("message_key", dedupeKey).maybeSingle();
      await supabase.from("webhook_dedupe")
        .update({ seen_count: (prev?.seen_count || 1) + 1, last_seen_at: new Date().toISOString() })
        .eq("message_key", dedupeKey);
      const rd = {
        ok: true, duplicate: true, reason: "already_processed",
        prospect_id: prev?.prospect_id ?? null, message_id: prev?.inbox_message_id ?? null,
      };
      finalize("success", 200, rd);
      return new Response(JSON.stringify(rd), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    // Hard blocklist: an unsubscribed / manually removed address never
    // re-activates automation, never gets a demo and never gets a reply.
    const { data: blockRow } = await supabase
      .from("unsubscribed_prospects").select("id").ilike("email", email).maybeSingle();
    const blocked = !!blockRow;

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
      if (blocked) {
        update.automation_paused = true;
        update.followup_status = "stopped";
        update.next_followup_at = null;
        update.next_followup_trigger = null;
      } else if (existing.followup_status && existing.followup_status !== "none") {
        update.followup_status = "responded";
      }
      await supabase.from("prospects").update(update).eq("id", prospectId);
      await supabase.from("followup_events").update({ status: "cancelled" }).eq("prospect_id", prospectId).eq("status", "pending");
      await supabase.from("follow_up_enrollments").update({ status: "responded", completed_at: new Date().toISOString() }).eq("prospect_id", prospectId).eq("status", "active");
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

    // Tracing + memory are observability, not correctness — run them off the hot path.
    background((async () => {
      await traceStep(prospectId, messageId, "webhook_received", "ok", {
        email, subject, has_body: !!body, manyreach_message_id: manyMessageId,
      });
      await traceStep(prospectId, messageId, "stored", "ok", { message_id: messageId });
      try { await recordReply(prospectId!, null); } catch (err) { console.error("recordReply failed:", err); }
    })());

    // Blocked address: the message is stored for the record only. No
    // classification, no demo build, no reply is ever generated or sent.
    if (blocked) {
      background(traceStep(prospectId, messageId, "classified", "skipped", { reason: "blocked_unsubscribed", email }));
      const rb = { ok: true, blocked: true, reason: "unsubscribed", prospect_id: prospectId, message_id: messageId };
      finalize("success", 200, rb);
      return new Response(JSON.stringify(rb), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fire-and-forget orchestrator
    fetch(`${SUPABASE_URL}/functions/v1/inbox-process-incoming`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ prospect_id: prospectId, message_id: messageId }),
    }).catch((e) => console.error("orchestrator dispatch failed:", e));

    const r = { ok: true, prospect_id: prospectId, message_id: messageId };
    finalize("success", 200, r);
    return new Response(JSON.stringify(r), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("manyreach webhook error:", e);
    const msg = String((e as any)?.message || e);
    const stack = (e as any)?.stack || null;
    finalize("failed", 500, { error: msg }, msg);
    background(logError("webhook", msg, { prospect_id: prospectId, message_id: messageId, stack }));
    background(traceStep(prospectId, messageId, "webhook_received", "failed", null, msg));
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}