// Shared observability helpers for the Inbox v2 system.
// Best-effort logging — failures are swallowed so they NEVER break the caller.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

export async function logWebhook(args: {
  endpoint: string;
  method?: string;
  status: "success" | "failed";
  status_code?: number;
  response_ms?: number;
  payload?: unknown;
  response?: unknown;
  error?: string | null;
  source?: string | null;
}) {
  try {
    await sb.from("webhook_logs").insert({
      endpoint: args.endpoint,
      method: args.method || "POST",
      status: args.status,
      status_code: args.status_code ?? null,
      response_ms: args.response_ms ?? null,
      payload: args.payload ?? null,
      response: args.response ?? null,
      error: args.error ?? null,
      source: args.source ?? null,
    });
  } catch (e) {
    console.error("logWebhook failed:", e);
  }
}

export async function traceStep(
  prospect_id: string | null,
  message_id: string | null,
  step: string,
  status: "ok" | "skipped" | "failed",
  details: Record<string, unknown> | null = null,
  error: string | null = null,
) {
  try {
    await sb.from("pipeline_events").insert({
      prospect_id, message_id, step, status, details, error,
    });
  } catch (e) {
    console.error("traceStep failed:", e);
  }
}

export async function logError(
  source: string,
  message: string,
  opts: { prospect_id?: string | null; message_id?: string | null; stack?: string | null } = {},
) {
  try {
    await sb.from("error_events").insert({
      source,
      message,
      stack: opts.stack ?? null,
      prospect_id: opts.prospect_id ?? null,
      message_id: opts.message_id ?? null,
    });
  } catch (e) {
    console.error("logError failed:", e);
  }
}
