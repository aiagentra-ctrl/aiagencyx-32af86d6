// Admin CRUD for webhook endpoints. Runs with the service role so the token
// registry itself is never exposed to the browser via the Data API.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const baseUrl = () => Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return "wh_" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const decorate = (row: any) => ({ ...row, url: `${baseUrl()}/functions/v1/hook/${row.token}` });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action = "list", id, label, provider } = await req.json().catch(() => ({}));

    switch (action) {
      case "list": {
        const { data, error } = await admin
          .from("webhook_endpoints").select("*").order("created_at", { ascending: true });
        if (error) throw error;
        return json({ endpoints: (data ?? []).map(decorate) });
      }

      case "create": {
        const name = String(label || "").trim() || "New webhook";
        if (name.length > 80) return json({ error: "Label too long (max 80)." }, 400);
        const { data, error } = await admin
          .from("webhook_endpoints")
          .insert({ label: name, token: newToken(), provider: provider || "manyreach" })
          .select("*").single();
        if (error) throw error;
        return json({ endpoint: decorate(data) });
      }

      case "regenerate": {
        if (!id) return json({ error: "id required" }, 400);
        const { data, error } = await admin
          .from("webhook_endpoints")
          .update({ token: newToken(), hit_count: 0, last_status: null, last_used_at: null })
          .eq("id", id).select("*").single();
        if (error) throw error;
        return json({ endpoint: decorate(data) });
      }

      case "rename": {
        if (!id) return json({ error: "id required" }, 400);
        const name = String(label || "").trim();
        if (!name || name.length > 80) return json({ error: "Label must be 1–80 chars." }, 400);
        const { data, error } = await admin
          .from("webhook_endpoints").update({ label: name }).eq("id", id).select("*").single();
        if (error) throw error;
        return json({ endpoint: decorate(data) });
      }

      case "toggle": {
        if (!id) return json({ error: "id required" }, 400);
        const { data: cur } = await admin
          .from("webhook_endpoints").select("active").eq("id", id).maybeSingle();
        const { data, error } = await admin
          .from("webhook_endpoints").update({ active: !cur?.active }).eq("id", id).select("*").single();
        if (error) throw error;
        return json({ endpoint: decorate(data) });
      }

      case "delete": {
        if (!id) return json({ error: "id required" }, 400);
        const { error } = await admin.from("webhook_endpoints").delete().eq("id", id);
        if (error) throw error;
        return json({ ok: true });
      }

      case "test": {
        if (!id) return json({ error: "id required" }, 400);
        const { data: row } = await admin
          .from("webhook_endpoints").select("*").eq("id", id).maybeSingle();
        if (!row) return json({ error: "not found" }, 404);

        const target = `${baseUrl()}/functions/v1/hook/${row.token}`;
        const t0 = Date.now();
        const res = await fetch(target, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prospect: {
              email: `healthcheck-test@example.com`,
              firstname: "Health",
              company: "Webhook Test",
              www: "https://example.com",
            },
            campaign: { campaignID: "test", campaignTitle: "Endpoint test" },
            subject: "Webhook connectivity test",
            message: "This is an automated test delivery from the admin panel.",
            messageId: `test-${crypto.randomUUID()}`,
          }),
        });
        const bodyText = await res.text();
        return json({
          ok: res.ok,
          status_code: res.status,
          response_ms: Date.now() - t0,
          body: bodyText.slice(0, 500),
        });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    const msg = String((e as any)?.message || e);
    console.error("[manage-webhook-endpoints]", msg);
    return json({ error: msg }, 500);
  }
});
