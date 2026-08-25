// Admin CRUD + test endpoint for ManyReach mailbox routing.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { manyreachPing } from "../_shared/manyreach.ts";
import { resolveManyreachAccount, maskKey } from "../_shared/manyreach-routing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const ADMIN_KEY = Deno.env.get("ADMIN_PANEL_PASSWORD") || "Abhiraj@123";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function shape(row: any) {
  return {
    id: row.id,
    label: row.label,
    email: row.email,
    manyreach_account_id: row.manyreach_account_id,
    account_name: row.account?.name ?? null,
    account_active: row.account?.active ?? null,
    uses_default_account: row.uses_default_account,
    active: row.active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const admin_key = req.headers.get("x-admin-key") || body.admin_key;
    if (admin_key !== ADMIN_KEY) return json({ error: "unauthorized" }, 401);

    const action = body.action as string;
    const p = body.params ?? {};

    switch (action) {
      case "list": {
        const { data, error } = await sb
          .from("manyreach_mailboxes")
          .select("*, account:manyreach_accounts(id, name, active)")
          .order("created_at", { ascending: true });
        if (error) throw error;
        return json({ data: (data ?? []).map(shape) });
      }

      case "create": {
        if (!p.email) return json({ error: "email required" }, 400);
        if (!p.uses_default_account && !p.manyreach_account_id) {
          return json({ error: "pick an account or use the default" }, 400);
        }
        const { data, error } = await sb.from("manyreach_mailboxes").insert({
          label: p.label || "",
          email: String(p.email).trim(),
          manyreach_account_id: p.uses_default_account ? null : p.manyreach_account_id,
          uses_default_account: !!p.uses_default_account,
          active: p.active !== false,
        }).select("*, account:manyreach_accounts(id, name, active)").single();
        if (error) {
          if (String(error.message).includes("duplicate")) return json({ error: "That mailbox is already routed." }, 400);
          throw error;
        }
        return json({ data: shape(data) });
      }

      case "update": {
        if (!p.id) return json({ error: "id required" }, 400);
        const patch: Record<string, unknown> = {};
        for (const k of ["label", "email", "active", "uses_default_account"]) {
          if (p[k] !== undefined) patch[k] = p[k];
        }
        if (p.manyreach_account_id !== undefined) {
          patch.manyreach_account_id = p.uses_default_account ? null : p.manyreach_account_id;
        }
        const { data, error } = await sb.from("manyreach_mailboxes").update(patch).eq("id", p.id)
          .select("*, account:manyreach_accounts(id, name, active)").single();
        if (error) throw error;
        return json({ data: shape(data) });
      }

      case "delete": {
        if (!p.id) return json({ error: "id required" }, 400);
        const { error } = await sb.from("manyreach_mailboxes").delete().eq("id", p.id);
        if (error) throw error;
        return json({ data: { deleted: true } });
      }

      case "test": {
        // Resolve exactly like a real send would, then ping that account.
        const email = p.email as string | undefined;
        if (!email) return json({ error: "email required" }, 400);
        const resolved = await resolveManyreachAccount({ mailboxEmail: email, allowInactive: true });
        const r = await manyreachPing({ mailboxEmail: email, allowInactive: true });
        return json({
          data: {
            ok: r.ok, status: r.status, error: r.error, ms: r.ms,
            resolved: {
              account_id: resolved.accountId,
              account_name: resolved.accountName,
              source: resolved.source,
              active: resolved.active,
              key: maskKey(resolved.key),
              configured: resolved.configured,
            },
          },
        });
      }

      default:
        return json({ error: `unknown action: ${action}` }, 400);
    }
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
