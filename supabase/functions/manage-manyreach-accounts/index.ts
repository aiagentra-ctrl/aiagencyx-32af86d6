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

const mask = (v: string | null | undefined) => {
  const s = String(v || "").trim();
  if (!s) return null;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
};

async function clearDefault(excludeId?: string) {
  let q = sb.from("manyreach_accounts").update({ is_default: false, updated_at: new Date().toISOString() });
  if (excludeId) q = q.neq("id", excludeId);
  await q;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { action = "list" } = body;

    switch (action) {
      case "status": {
        const { data: rows } = await sb.from("manyreach_accounts").select("id, is_default, active").eq("active", true);
        return json({
          has_env_default: !!Deno.env.get("MANYREACH_API_KEY"),
          active_db_accounts: rows?.length || 0,
          has_db_default: !!(rows || []).find((r: any) => r.is_default),
        });
      }

      case "list": {
        const { data, error } = await sb
          .from("manyreach_accounts")
          .select("id, name, api_key, active, is_default, webhook_secret, notes, created_at, updated_at")
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: true });
        if (error) throw error;
        return json({
          data: (data || []).map((row: any) => ({
            ...row,
            api_key_masked: mask(row.api_key),
            api_key: undefined,
            webhook_secret_masked: mask(row.webhook_secret),
            webhook_secret: undefined,
          })),
          env_key_configured: !!Deno.env.get("MANYREACH_API_KEY"),
        });
      }

      case "create": {
        const name = String(body?.name || "").trim();
        const api_key = String(body?.api_key || "").trim();
        if (!name) return json({ error: "name required" }, 400);
        if (!api_key) return json({ error: "api_key required" }, 400);

        const is_default = !!body?.is_default;
        if (is_default) await clearDefault();

        const { data, error } = await sb
          .from("manyreach_accounts")
          .insert({
            name,
            api_key,
            is_default,
            active: body?.active !== false,
            webhook_secret: body?.webhook_secret || null,
            notes: body?.notes || null,
          })
          .select("id, name, api_key, active, is_default, webhook_secret, notes, created_at, updated_at")
          .single();
        if (error) throw error;
        return json({
          data: {
            ...data,
            api_key_masked: mask((data as any).api_key),
            api_key: undefined,
            webhook_secret_masked: mask((data as any).webhook_secret),
            webhook_secret: undefined,
          },
        });
      }

      case "update": {
        const id = String(body?.id || "").trim();
        if (!id) return json({ error: "id required" }, 400);

        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (body?.name !== undefined) patch.name = String(body.name || "").trim();
        if (body?.api_key !== undefined) {
          const nextKey = String(body.api_key || "").trim();
          if (!nextKey) return json({ error: "api_key cannot be empty" }, 400);
          patch.api_key = nextKey;
        }
        if (body?.active !== undefined) patch.active = !!body.active;
        if (body?.webhook_secret !== undefined) patch.webhook_secret = String(body.webhook_secret || "").trim() || null;
        if (body?.notes !== undefined) patch.notes = String(body.notes || "").trim() || null;
        if (body?.is_default !== undefined) {
          patch.is_default = !!body.is_default;
          if (body.is_default) await clearDefault(id);
        }

        const { data, error } = await sb
          .from("manyreach_accounts")
          .update(patch)
          .eq("id", id)
          .select("id, name, api_key, active, is_default, webhook_secret, notes, created_at, updated_at")
          .single();
        if (error) throw error;
        return json({
          data: {
            ...data,
            api_key_masked: mask((data as any).api_key),
            api_key: undefined,
            webhook_secret_masked: mask((data as any).webhook_secret),
            webhook_secret: undefined,
          },
        });
      }

      case "delete": {
        const id = String(body?.id || "").trim();
        if (!id) return json({ error: "id required" }, 400);
        const { error } = await sb.from("manyreach_accounts").delete().eq("id", id);
        if (error) throw error;
        return json({ ok: true });
      }

      case "toggle": {
        const id = String(body?.id || "").trim();
        if (!id) return json({ error: "id required" }, 400);
        const active = body?.active !== undefined ? !!body.active : undefined;
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (active !== undefined) patch.active = active;
        const { data, error } = await sb
          .from("manyreach_accounts")
          .update(patch)
          .eq("id", id)
          .select("id, name, api_key, active, is_default, webhook_secret, notes, created_at, updated_at")
          .single();
        if (error) throw error;
        return json({ data: { ...data, api_key_masked: mask((data as any).api_key), api_key: undefined, webhook_secret_masked: mask((data as any).webhook_secret), webhook_secret: undefined } });
      }

      case "test": {
        const id = String(body?.id || "").trim();
        if (!id) return json({ error: "id required" }, 400);
        const { data: row } = await sb
          .from("manyreach_accounts")
          .select("id, name, api_key, active")
          .eq("id", id)
          .maybeSingle();
        if (!row) return json({ error: "not found" }, 404);
        if (!row.api_key) return json({ error: "api_key required for testing" }, 400);
        const ping = await manyreachPing({ accountId: id, allowInactive: true });
        return json({ ok: ping.ok, status: ping.status, data: ping.data, error: ping.error });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
