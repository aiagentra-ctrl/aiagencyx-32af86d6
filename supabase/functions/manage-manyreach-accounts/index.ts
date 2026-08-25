// Admin CRUD + test endpoint for ManyReach accounts.
// Gated by the shared admin panel key (same scheme as admin-data).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { manyreachPing } from "../_shared/manyreach.ts";
import { maskKey, envKeyConfigured } from "../_shared/manyreach-routing.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const ADMIN_KEY = Deno.env.get("ADMIN_PANEL_PASSWORD") || "Abhiraj@123";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** Public shape — never leaks a raw API key. */
function shape(row: any) {
  return {
    id: row.id,
    name: row.name,
    use_env_key: row.use_env_key,
    api_key_masked: row.use_env_key
      ? (envKeyConfigured() ? "env ••••" : null)
      : maskKey(row.api_key),
    has_key: row.use_env_key ? envKeyConfigured() : !!row.api_key,
    webhook_secret_masked: maskKey(row.webhook_secret),
    notes: row.notes,
    active: row.active,
    is_default: row.is_default,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function clearOtherDefaults(id?: string) {
  let q = sb.from("manyreach_accounts").update({ is_default: false }).eq("is_default", true);
  if (id) q = q.neq("id", id);
  await q;
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
        const { data, error } = await sb.from("manyreach_accounts").select("*")
          .order("is_default", { ascending: false }).order("created_at", { ascending: true });
        if (error) throw error;
        return json({ data: (data ?? []).map(shape), env_key_configured: envKeyConfigured() });
      }

      case "create": {
        if (!p.name) return json({ error: "name required" }, 400);
        if (!p.use_env_key && !p.api_key) return json({ error: "api_key required" }, 400);
        if (p.is_default) await clearOtherDefaults();
        const { data, error } = await sb.from("manyreach_accounts").insert({
          name: p.name,
          api_key: p.use_env_key ? null : p.api_key,
          use_env_key: !!p.use_env_key,
          webhook_secret: p.webhook_secret || null,
          notes: p.notes || null,
          active: p.active !== false,
          is_default: !!p.is_default,
        }).select("*").single();
        if (error) throw error;
        return json({ data: shape(data) });
      }

      case "update": {
        if (!p.id) return json({ error: "id required" }, 400);
        const patch: Record<string, unknown> = {};
        for (const k of ["name", "notes", "active", "use_env_key"]) {
          if (p[k] !== undefined) patch[k] = p[k];
        }
        // Blank key = keep the stored one (masked in the UI).
        if (p.api_key) patch.api_key = p.api_key;
        if (p.use_env_key === true) patch.api_key = null;
        if (p.webhook_secret !== undefined && p.webhook_secret !== "") patch.webhook_secret = p.webhook_secret;
        if (p.is_default === true) { await clearOtherDefaults(p.id); patch.is_default = true; }
        if (p.is_default === false) patch.is_default = false;
        const { data, error } = await sb.from("manyreach_accounts").update(patch).eq("id", p.id).select("*").single();
        if (error) throw error;
        return json({ data: shape(data) });
      }

      case "delete": {
        if (!p.id) return json({ error: "id required" }, 400);
        const { data: acc } = await sb.from("manyreach_accounts").select("is_default").eq("id", p.id).maybeSingle();
        if (acc?.is_default) return json({ error: "Cannot delete the default account. Make another account default first." }, 400);
        const { error } = await sb.from("manyreach_accounts").delete().eq("id", p.id);
        if (error) throw error;
        return json({ data: { deleted: true } });
      }

      case "test": {
        // Admin tests must hit the selected account even when it is disabled.
        const r = await manyreachPing({ accountId: p.id ?? null, allowInactive: true });
        return json({
          data: {
            ok: r.ok, status: r.status, error: r.error,
            attempts: r.attempts, ms: r.ms, account: r.account ?? null,
            campaigns: Array.isArray(r.data) ? r.data.length : (r.data?.campaigns?.length ?? null),
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
