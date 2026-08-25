// Single hardened ManyReach REST client.
// - X-API-Key auth from the selected ManyReach account (or the legacy env key)
// - 15s timeout, 3 attempts with backoff on 429/5xx/network
// - every call logged to webhook_logs (no silent failures)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ManyReachAccountRef, resolveManyReachAccount } from "./manyreach-routing.ts";

const BASE = "https://api.manyreach.com/api/v2";
const TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;
const DEFAULT_KEY = Deno.env.get("MANYREACH_API_KEY") || "";

const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

export type ManyReachResult<T = any> = {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
  attempts: number;
  ms: number;
};

export function manyreachConfigured(): boolean {
  return !!DEFAULT_KEY;
}

async function logCall(endpoint: string, payload: unknown, r: ManyReachResult) {
  try {
    await admin().from("webhook_logs").insert({
      endpoint: `manyreach:${endpoint}`,
      method: "POST",
      status: r.ok ? "success" : "failed",
      status_code: r.status,
      response_ms: r.ms,
      payload: payload as any,
      response: (r.data ?? { error: r.error }) as any,
      error: r.error,
      source: "manyreach",
    });
  } catch (_) { /* logging must never break the send */ }
}

/** Low-level ManyReach request with retries. `path` is relative to /api/v2. */
export async function manyreachRequest<T = any>(
  path: string,
  init: { method?: string; body?: unknown } = {},
  ref: ManyReachAccountRef = {},
): Promise<ManyReachResult<T>> {
  const t0 = Date.now();
  const method = init.method || "POST";
  const url = path.startsWith("http") ? path : `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const account = await resolveManyReachAccount(ref);
  const key = account.apiKey;

  if (!key) {
    const res: ManyReachResult<T> = { ok: false, status: 0, data: null, error: "MANYREACH_API_KEY not configured", attempts: 0, ms: 0 };
    await logCall(path, init.body ?? null, res);
    return res;
  }

  let last: ManyReachResult<T> = { ok: false, status: 0, data: null, error: "not attempted", attempts: 0, ms: 0 };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "X-API-Key": key },
        body: init.body !== undefined && method !== "GET" ? JSON.stringify(init.body) : undefined,
        signal: ctl.signal,
      });
      const raw = await res.text();
      let parsed: any = null;
      try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = { raw: raw.slice(0, 2000) }; }

      last = {
        ok: res.ok,
        status: res.status,
        data: parsed,
        error: res.ok ? null : `HTTP ${res.status}: ${String(raw).slice(0, 400)}`,
        attempts: attempt,
        ms: Date.now() - t0,
      };

      const retryable = res.status === 429 || res.status >= 500;
      if (res.ok || !retryable || attempt === MAX_ATTEMPTS) break;
    } catch (e) {
      last = {
        ok: false,
        status: 0,
        data: null,
        error: `network: ${String((e as any)?.message || e)}`,
        attempts: attempt,
        ms: Date.now() - t0,
      };
      if (attempt === MAX_ATTEMPTS) break;
    } finally {
      clearTimeout(timer);
    }
    await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
  }

  await logCall(path, init.body ?? null, last);
  return last;
}

export type ReplyPayload = {
  messageId: string;
  subject: string;
  body: string;
  fromEmail?: string | null;
  replyToEmail?: string | null;
  mailboxEmail?: string | null;
  accountId?: string | null;
};

/** Send a threaded reply. */
export async function sendReply(p: ReplyPayload): Promise<ManyReachResult> {
  return await manyreachRequest("/messages/reply", {
    method: "POST",
    body: {
      messageId: p.messageId,
      subject: p.subject,
      body: p.body,
      sendAsReply: "true",
      fromEmail: p.fromEmail,
      replyToEmail: p.replyToEmail,
    },
  }, { accountId: p.accountId ?? null, mailboxEmail: p.mailboxEmail ?? p.fromEmail ?? p.replyToEmail ?? null });
}

/** Extract the message id ManyReach returned, whatever shape it used. */
export function extractMessageId(data: any): string | null {
  return data?.messageId || data?.id || data?.data?.messageId || data?.data?.id || null;
}

/** Lightweight connectivity probe used by the dashboard + health check. */
export async function manyreachPing(ref: ManyReachAccountRef = {}): Promise<ManyReachResult> {
  return await manyreachRequest("/campaigns", { method: "GET" }, ref);
}
