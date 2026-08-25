import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { manyreachPing } from "../_shared/manyreach.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function norm(email: string): string {
  return String(email || "").trim().toLowerCase();
}

async function loadAccounts() {
  const { data } = await sb
    .from("manyreach_accounts")
    .select("id, name, active, is_default")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  return data || [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { action = "list" } = body;

    switch (action) {
      case "list": {
        const [mailboxes, accounts] = await Promise.all([
          sb.from("manyreach_mailboxes").select("id, label, email, manyreach_account_id, uses_default_account, active, created_at, updated_at").order("created_at", { ascending: true }),
          loadAccounts(),
        ]);
        const accountMap = new Map((accounts || []).map((a: any) => [a.id, a]));
        return json({
          data: (mailboxes.data || []).map((m: any) => ({
            ...m,
            account_name: m.uses_default_account ? "Current default (env)" : accountMap.get(m.manyreach_account_id)?.name || "Unknown account",
          })),
          accounts,
        });
      }

      case "create": {
        const label = String(body?.label || "").trim();
        const email = norm(String(body?.email || ""));
        if (!label) return json({ error: "label required" }, 400);
        if (!email) return json({ error: "email required" }, 400);

        const accountId = String(body?.manyreach_account_id || "").trim();
        const usesDefaultAccount = !accountId || accountId === "__default__" || body?.uses_default_account === true;
        if (!usesDefaultAccount) {
          const { data: account } = await sb.from("manyreach_accounts").select("id").eq("id", accountId).maybeSingle();
          if (!account) return json({ error: "ManyReach account not found" }, 404);
        }

        const { data, error } = await sb
          .from("manyreach_mailboxes")
          .insert({
            label,
            email,
            manyreach_account_id: usesDefaultAccount ? null : accountId,
            uses_default_account: usesDefaultAccount,
            active: body?.active !== false,
            updated_at: new Date().toISOString(),
          })
          .select("id, label, email, manyreach_account_id, uses_default_account, active, created_at, updated_at")
          .single();
        if (error) throw error;
        return json({ data });
      }

      case "update": {
        const id = String(body?.id || "").trim();
        if (!id) return json({ error: "id required" }, 400);
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (body?.label !== undefined) patch.label = String(body.label || "").trim();
        if (body?.email !== undefined) patch.email = norm(String(body.email || ""));
        if (body?.active !== undefined) patch.active = !!body.active;
        if (body?.manyreach_account_id !== undefined || body?.uses_default_account !== undefined) {
          const accountId = String(body?.manyreach_account_id || "").trim();
          const usesDefaultAccount = !accountId || accountId === "__default__" || body?.uses_default_account === true;
          patch.manyreach_account_id = usesDefaultAccount ? null : accountId;
          patch.uses_default_account = usesDefaultAccount;
          if (!usesDefaultAccount) {
            const { data: account } = await sb.from("manyreach_accounts").select("id").eq("id", accountId).maybeSingle();
            if (!account) return json({ error: "ManyReach account not found" }, 404);
          }
        }

        const { data, error } = await sb
          .from("manyreach_mailboxes")
          .update(patch)
          .eq("id", id)
          .select("id, label, email, manyreach_account_id, uses_default_account, active, created_at, updated_at")
          .single();
        if (error) throw error;
        return json({ data });
      }

      case "delete": {
        const id = String(body?.id || "").trim();
        if (!id) return json({ error: "id required" }, 400);
        const { error } = await sb.from("manyreach_mailboxes").delete().eq("id", id);
        if (error) throw error;
        return json({ ok: true });
      }

      case "toggle": {
        const id = String(body?.id || "").trim();
        if (!id) return json({ error: "id required" }, 400);
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (body?.active !== undefined) patch.active = !!body.active;
        const { data, error } = await sb
          .from("manyreach_mailboxes")
          .update(patch)
          .eq("id", id)
          .select("id, label, email, manyreach_account_id, uses_default_account, active, created_at, updated_at")
          .single();
        if (error) throw error;
        return json({ data });
      }

      case "test": {
        const id = String(body?.id || "").trim();
        if (!id) return json({ error: "id required" }, 400);
        const { data: row } = await sb
          .from("manyreach_mailboxes")
          .select("id, label, email, manyreach_account_id, uses_default_account, active")
          .eq("id", id)
          .maybeSingle();
        if (!row) return json({ error: "not found" }, 404);
        const ping = await manyreachPing({
          accountId: row.uses_default_account ? null : row.manyreach_account_id,
          mailboxEmail: row.email,
          allowInactive: true,
        });
        return json({ ok: ping.ok, status: ping.status, data: ping.data, error: ping.error });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
