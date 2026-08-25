// Resolves which ManyReach account (API key) a given send should use.
//
// Priority:
//   1. mailbox mapping (manyreach_mailboxes.email = mailboxEmail)
//   2. explicit accountId
//   3. default DB account (is_default = true, active)
//   4. legacy env key (MANYREACH_API_KEY) — account 1 keeps working untouched
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ENV_KEY = Deno.env.get("MANYREACH_API_KEY") || "";

const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

export type ResolveOptions = {
  mailboxEmail?: string | null;
  accountId?: string | null;
  /** Admin tests need to hit the chosen account even if it is disabled. */
  allowInactive?: boolean;
};

export type ResolvedAccount = {
  key: string;
  accountId: string | null;
  accountName: string;
  source: "mailbox" | "explicit" | "default" | "env";
  active: boolean;
  configured: boolean;
};

const ENV_ACCOUNT: ResolvedAccount = {
  key: ENV_KEY,
  accountId: null,
  accountName: "Account 1 (legacy env key)",
  source: "env",
  active: true,
  configured: !!ENV_KEY,
};

function fromRow(row: any, source: ResolvedAccount["source"]): ResolvedAccount {
  const key = row?.use_env_key ? ENV_KEY : (row?.api_key || "");
  return {
    key,
    accountId: row?.id ?? null,
    accountName: row?.name || "ManyReach account",
    source,
    active: !!row?.active,
    configured: !!key,
  };
}

/** Never throws — always returns something usable (env fallback). */
export async function resolveManyreachAccount(opts: ResolveOptions = {}): Promise<ResolvedAccount> {
  const sb = admin();
  try {
    if (opts.mailboxEmail) {
      const { data: mb } = await sb
        .from("manyreach_mailboxes")
        .select("*, account:manyreach_accounts(*)")
        .ilike("email", opts.mailboxEmail)
        .maybeSingle();
      if (mb && (mb.active || opts.allowInactive)) {
        if (!mb.uses_default_account && (mb as any).account) {
          const acc = (mb as any).account;
          if (acc.active || opts.allowInactive) return fromRow(acc, "mailbox");
        }
        // uses_default_account → fall through to default resolution
      }
    }

    if (opts.accountId) {
      const { data: acc } = await sb
        .from("manyreach_accounts").select("*").eq("id", opts.accountId).maybeSingle();
      if (acc && (acc.active || opts.allowInactive)) return fromRow(acc, "explicit");
    }

    const { data: def } = await sb
      .from("manyreach_accounts").select("*")
      .eq("is_default", true).eq("active", true).maybeSingle();
    if (def) {
      const resolved = fromRow(def, "default");
      if (resolved.configured) return resolved;
    }
  } catch (_) { /* fall back to env */ }

  return ENV_ACCOUNT;
}

/** Mask a key for admin display: never return the raw secret to the client. */
export function maskKey(key?: string | null): string | null {
  if (!key) return null;
  const k = String(key);
  if (k.length <= 8) return "••••";
  return `${k.slice(0, 4)}••••${k.slice(-4)}`;
}

export function envKeyConfigured(): boolean {
  return !!ENV_KEY;
}
