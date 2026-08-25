import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const DEFAULT_ENV_API_KEY = Deno.env.get("MANYREACH_API_KEY") || "";

export type ManyReachAccountRef = {
  accountId?: string | null;
  mailboxEmail?: string | null;
  allowInactive?: boolean;
};

export type ResolvedManyReachAccount = {
  accountId: string | null;
  accountName: string;
  apiKey: string;
  source: "env" | "database";
  mailboxEmail: string | null;
};

function normEmail(email: string | null | undefined): string {
  return String(email || "").trim().toLowerCase();
}

function envFallback(mailboxEmail: string | null): ResolvedManyReachAccount {
  return {
    accountId: null,
    accountName: "Default ManyReach",
    apiKey: DEFAULT_ENV_API_KEY,
    source: "env",
    mailboxEmail,
  };
}

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

async function loadAccountById(accountId: string | null | undefined): Promise<any | null> {
  if (!accountId) return null;
  const sb = admin();
  const { data } = await sb
    .from("manyreach_accounts")
    .select("id, name, api_key, active, is_default")
    .eq("id", accountId)
    .maybeSingle();
  return data || null;
}

async function loadDefaultAccount(): Promise<any | null> {
  const sb = admin();
  const { data } = await sb
    .from("manyreach_accounts")
    .select("id, name, api_key, active, is_default")
    .eq("active", true)
    .eq("is_default", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data || null;
}

async function loadAccountByMailbox(email: string | null | undefined): Promise<any | null> {
  const mailboxEmail = normEmail(email);
  if (!mailboxEmail) return null;
  const sb = admin();
  const { data } = await sb
    .from("manyreach_mailboxes")
    .select("id, label, email, active, uses_default_account, manyreach_account_id")
    .eq("email", mailboxEmail)
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  if (data.uses_default_account || !data.manyreach_account_id) return envFallback(mailboxEmail);
  return await loadAccountById(data.manyreach_account_id);
}

export async function resolveManyReachAccount(ref: ManyReachAccountRef = {}): Promise<ResolvedManyReachAccount> {
  const mailboxEmail = ref.mailboxEmail ? normEmail(ref.mailboxEmail) : null;
  const allowInactive = !!ref.allowInactive;

  const fromId = await safeQuery(() => loadAccountById(ref.accountId), null);
  if (fromId?.api_key && (allowInactive || fromId.active)) {
    return {
      accountId: fromId.id,
      accountName: fromId.name || "ManyReach account",
      apiKey: fromId.api_key,
      source: "database",
      mailboxEmail,
    };
  }

  const fromMailbox = await safeQuery(() => loadAccountByMailbox(mailboxEmail), null);
  if (fromMailbox?.api_key && (fromMailbox.source === "env" || allowInactive || fromMailbox.active)) {
    return {
      accountId: fromMailbox.id,
      accountName: fromMailbox.name || "ManyReach account",
      apiKey: fromMailbox.api_key,
      source: "database",
      mailboxEmail,
    };
  }

  const defaultDb = await safeQuery(() => loadDefaultAccount(), null);
  if (defaultDb?.api_key && (allowInactive || defaultDb.active)) {
    return {
      accountId: defaultDb.id,
      accountName: defaultDb.name || "Default ManyReach",
      apiKey: defaultDb.api_key,
      source: "database",
      mailboxEmail,
    };
  }

  return envFallback(mailboxEmail);
}

export async function hasAnyManyReachAccount(): Promise<boolean> {
  const resolved = await resolveManyReachAccount();
  return !!resolved.apiKey;
}
