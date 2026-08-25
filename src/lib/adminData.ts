// Client helper for the service-role `admin-data` edge function.
//
// The admin panel signs in with a shared password (not Supabase auth), so every
// direct table read runs as `anon` and is blocked by RLS. All dashboard reads go
// through this helper instead: it forwards the admin key and the edge function
// does the read with the service role.
import { supabase } from "@/integrations/supabase/client";

const ADMIN_KEY_STORAGE = "admin_key";

export function setAdminKey(key: string) {
  sessionStorage.setItem(ADMIN_KEY_STORAGE, key);
}

export function clearAdminKey() {
  sessionStorage.removeItem(ADMIN_KEY_STORAGE);
}

export function getAdminKey(): string {
  return sessionStorage.getItem(ADMIN_KEY_STORAGE) || "";
}

export type AdminResource =
  | "inbox"
  | "conversations"
  | "conversation_messages"
  | "leads"
  | "leads_legacy"
  | "tracking"
  | "overview"
  | "sync_leads"
  | "demo_jobs"
  | "ai_keys"
  | "test_openrouter_key"
  | "save_openrouter_key";

/**
 * Fetch a resource through the admin-data edge function.
 * Throws on transport / auth errors so callers can surface a real message.
 */
export async function adminFetch<T = any>(
  resource: AdminResource,
  params: Record<string, unknown> = {},
): Promise<T> {
  const admin_key = getAdminKey();
  const { data, error } = await supabase.functions.invoke("admin-data", {
    body: { resource, params, admin_key },
    headers: admin_key ? { "x-admin-key": admin_key } : undefined,
  });

  if (error) {
    let detail = error.message;
    try {
      const ctx = (error as any)?.context;
      if (ctx?.text) detail = await ctx.text();
    } catch { /* ignore */ }
    throw new Error(`admin-data(${resource}) failed: ${detail}`);
  }
  if ((data as any)?.error) throw new Error(`admin-data(${resource}): ${(data as any).error}`);
  return (data as any)?.data as T;
}

/** Same as adminFetch but never throws — returns the fallback instead. */
export async function adminFetchSafe<T>(
  resource: AdminResource,
  fallback: T,
  params: Record<string, unknown> = {},
): Promise<T> {
  try {
    const out = await adminFetch<T>(resource, params);
    return (out ?? fallback) as T;
  } catch (e) {
    console.error(e);
    return fallback;
  }
}
