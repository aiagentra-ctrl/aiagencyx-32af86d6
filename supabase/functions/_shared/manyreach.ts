// Single hardened ManyReach REST client.
// - X-API-Key auth from MANYREACH_API_KEY
// - 15s timeout, 3 attempts with backoff on 429/5xx/network
// - every call logged to webhook_logs (no silent failures)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveManyreachAccount, type ResolveOptions, type ResolvedAccount } from "./manyreach-routing.ts";

const BASE = "https://api.manyreach.com/api/v2";
const KEY = Deno.env.get("MANYREACH_API_KEY") || "";
const TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 3;

const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

export type ManyReachResult<T = any> = {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
  attempts: number;
  ms: number;
  /** Which ManyReach account actually handled the call. */
  account?: { id: string | null; name: string; source: string };
};

/** Routing hints callers can attach to any request. */
export type Routing = ResolveOptions;

export function manyreachConfigured(): boolean {
  return !!KEY;
}

async function logCall(endpoint: string, payload: unknown, r: ManyReachResult) {
  try {
    await admin().from("webhook_logs").insert({
      endpoint: `manyreach:${endpoint}${r.account?.name ? ` [${r.account.name}]` : ""}`,
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
  init: { method?: string; body?: unknown; routing?: Routing } = {},
): Promise<ManyReachResult<T>> {
  const t0 = Date.now();
  const method = init.method || "POST";
  const url = path.startsWith("http") ? path : `${BASE}${path.startsWith("/") ? path : `/${path}`}`;

  const acc: ResolvedAccount = await resolveManyreachAccount(init.routing ?? {});
  const accountMeta = { id: acc.accountId, name: acc.accountName, source: acc.source };
  const KEY = acc.key;

  if (!KEY) {
    const res: ManyReachResult<T> = { ok: false, status: 0, data: null, error: `ManyReach API key not configured for ${acc.accountName}`, attempts: 0, ms: 0, account: accountMeta };
    await logCall(path, init.body ?? null, res);
    return res;
  }

  let last: ManyReachResult<T> = { ok: false, status: 0, data: null, error: "not attempted", attempts: 0, ms: 0, account: accountMeta };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "X-API-Key": KEY },
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
        account: accountMeta,
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
        account: accountMeta,
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
  /** Explicit account override (admin tests). Otherwise fromEmail routes it. */
  accountId?: string | null;
  allowInactive?: boolean;
};

/** Send a threaded reply through the account mapped to the sending mailbox. */
export async function sendReply(p: ReplyPayload): Promise<ManyReachResult> {
  return await manyreachRequest("/messages/reply", {
    method: "POST",
    routing: { mailboxEmail: p.fromEmail, accountId: p.accountId, allowInactive: p.allowInactive },
    body: {
      messageId: p.messageId,
      subject: p.subject,
      body: p.body,
      sendAsReply: "true",
      fromEmail: p.fromEmail,
      replyToEmail: p.replyToEmail,
    },
  });
}

/** Extract the message id ManyReach returned, whatever shape it used. */
export function extractMessageId(data: any): string | null {
  return data?.messageId || data?.id || data?.data?.messageId || data?.data?.id || null;
}

/** Lightweight connectivity probe used by the dashboard + health check. */
export async function manyreachPing(routing: Routing = {}): Promise<ManyReachResult> {
  return await manyreachRequest("/campaigns", { method: "GET", routing });
}