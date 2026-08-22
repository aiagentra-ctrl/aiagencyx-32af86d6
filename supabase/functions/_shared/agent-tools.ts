/**
 * Shared plumbing for the production Vapi / chatbot tools.
 *
 * Every tool returns `{ mode: "live" | "demo", ... }` so the agent (and the
 * dashboard) can tell whether a real Google Calendar / Gmail call happened.
 * Demo mode NEVER claims a real side effect the system did not perform.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

const GATEWAY = "https://connector-gateway.lovable.dev";

export function calendarReady(): boolean {
  return !!(Deno.env.get("LOVABLE_API_KEY") && Deno.env.get("GOOGLE_CALENDAR_API_KEY"));
}
export function gmailReady(): boolean {
  return !!(Deno.env.get("LOVABLE_API_KEY") && Deno.env.get("GOOGLE_MAIL_API_KEY"));
}

async function gatewayFetch(
  connector: "google_calendar" | "google_mail",
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; body: any }> {
  const key = connector === "google_calendar"
    ? Deno.env.get("GOOGLE_CALENDAR_API_KEY")
    : Deno.env.get("GOOGLE_MAIL_API_KEY");
  const res = await fetch(`${GATEWAY}/${connector}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      "X-Connection-Api-Key": key ?? "",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body: any = text;
  try { body = text ? JSON.parse(text) : null; } catch { /* keep raw text */ }
  if (!res.ok) {
    console.error(`[gateway ${connector}] ${res.status}: ${String(text).slice(0, 600)}`);
  }
  return { ok: res.ok, status: res.status, body };
}

export const calendarApi = (path: string, init?: RequestInit) =>
  gatewayFetch("google_calendar", `/calendar/v3${path}`, init);
export const gmailApi = (path: string, init?: RequestInit) =>
  gatewayFetch("google_mail", `/gmail/v1${path}`, init);

/** app_config key/value store (site_url, office email, scheduling defaults). */
export async function loadConfig(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  try {
    const { data } = await admin().from("app_config").select("key, value");
    for (const r of data || []) out[r.key] = r.value ?? "";
  } catch { /* table may not exist yet */ }
  return out;
}

export async function getSiteUrl(): Promise<string> {
  const cfg = await loadConfig();
  return (cfg.site_url || Deno.env.get("SITE_URL") || "https://aiagencyx.lovable.app").replace(/\/+$/, "");
}

// ── Vapi tool-call plumbing ────────────────────────────────────────────────
export type ToolCall = { args: Record<string, any>; toolCallId?: string; metadata: Record<string, any> };

export function parseToolCall(body: any): ToolCall {
  const tc = body?.message?.toolCalls?.[0] || body?.toolCalls?.[0];
  let args: any = tc?.function?.arguments ?? {};
  if (typeof args === "string") { try { args = JSON.parse(args); } catch { args = {}; } }
  const metadata = body?.message?.assistant?.metadata
    || body?.message?.call?.assistantOverrides?.metadata
    || body?.metadata || {};
  if (!tc) return { args: body || {}, toolCallId: undefined, metadata };
  return { args: args || {}, toolCallId: tc?.id, metadata };
}

export function toolResponse(toolCallId: string | undefined, payload: unknown) {
  const result = typeof payload === "string" ? payload : JSON.stringify(payload);
  const body = toolCallId ? { results: [{ toolCallId, result }] } : payload;
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Slot helpers ───────────────────────────────────────────────────────────
export type Slot = { date: string; time: string; start_iso: string; end_iso: string; label: string };

const WINDOWS: Record<string, number[]> = {
  morning: [9, 11],
  afternoon: [13, 15],
  any: [10, 14],
};

function fmtLabel(d: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
      timeZone: tz,
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

/** Candidate slots honouring Saturday / Sunday / lead-time rules. */
export function candidateSlots(opts: {
  window: string;
  saturdayRequested: boolean;
  sundayAvailable: boolean;
  minLeadDays: number;
  saturdayMinDays: number;
  proposedDate?: string | null;
  timezone: string;
  count?: number;
  durationMin?: number;
}): Slot[] {
  const hours = WINDOWS[opts.window] || WINDOWS.any;
  const out: Slot[] = [];
  const now = new Date();
  const start = new Date(now.getTime() + opts.minLeadDays * 86400000);
  const limit = opts.count ?? 2;
  const duration = (opts.durationMin ?? 60) * 60000;

  for (let d = 0; d < 45 && out.length < limit; d++) {
    const day = new Date(start.getTime() + d * 86400000);
    const dow = day.getUTCDay();
    if (dow === 0 && !opts.sundayAvailable) continue;
    if (dow === 6) {
      if (!opts.saturdayRequested) continue;
      const daysOut = (day.getTime() - now.getTime()) / 86400000;
      if (daysOut < opts.saturdayMinDays) continue;
    } else if (opts.saturdayRequested) {
      continue;
    }
    const iso = day.toISOString().slice(0, 10);
    if (opts.proposedDate && iso !== opts.proposedDate) continue;
    for (const h of hours) {
      if (out.length >= limit) break;
      const s = new Date(`${iso}T${String(h).padStart(2, "0")}:00:00Z`);
      const e = new Date(s.getTime() + duration);
      out.push({
        date: iso,
        time: `${((h + 11) % 12) + 1}:00 ${h < 12 ? "AM" : "PM"}`,
        start_iso: s.toISOString(),
        end_iso: e.toISOString(),
        label: fmtLabel(s, opts.timezone),
      });
    }
  }
  return out;
}

export function hasFullAddress(a: {
  street?: string; city?: string; state?: string; zip?: string;
}): boolean {
  return !!(a.street && a.city && a.state && /^\d{5}$/.test(String(a.zip || "").trim()));
}

export function base64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sendGmail(opts: {
  to: string; subject: string; body: string; cc?: string;
}): Promise<{ ok: boolean; id?: string; error?: string; status?: number }> {
  if (!gmailReady()) return { ok: false, error: "gmail_not_connected" };
  const raw = base64Url([
    `To: ${opts.to}`,
    ...(opts.cc ? [`Cc: ${opts.cc}`] : []),
    `Subject: ${opts.subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    opts.body,
  ].join("\r\n"));
  const res = await gmailApi("/users/me/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) {
    return { ok: false, error: typeof res.body === "string" ? res.body : JSON.stringify(res.body), status: res.status };
  }
  return { ok: true, id: res.body?.id };
}
