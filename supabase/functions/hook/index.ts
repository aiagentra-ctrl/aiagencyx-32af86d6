// Clean, production-ready webhook entry point.
//
//   POST /functions/v1/hook/<token>   → deliver payload
//   GET  /functions/v1/hook/<token>   → health probe (providers ping before saving)
//
// The <token> is an opaque, revocable identifier stored in public.webhook_endpoints —
// NOT the shared INBOX_WEBHOOK_SECRET, and never a URL nested inside a URL.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleManyreachWebhook } from "../_shared/manyreach-webhook.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function extractToken(url: URL): string | null {
  const segments = url.pathname.split("/").filter(Boolean);
  const idx = segments.lastIndexOf("hook");
  if (idx >= 0 && segments.length > idx + 1) return decodeURIComponent(segments[idx + 1]);
  return url.searchParams.get("token");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const token = extractToken(url);

  if (!token || !/^[A-Za-z0-9_-]{6,64}$/.test(token)) {
    return json({ error: "not_found", message: "Unknown webhook endpoint." }, 404);
  }

  const { data: endpoint } = await admin
    .from("webhook_endpoints")
    .select("id, label, provider, active")
    .eq("token", token)
    .maybeSingle();

  if (!endpoint) {
    return json({ error: "not_found", message: "Unknown webhook endpoint." }, 404);
  }
  if (!endpoint.active) {
    return json({ error: "gone", message: "This webhook endpoint has been disabled." }, 410);
  }

  // Health probe — lets providers validate the URL before saving it.
  if (req.method === "GET" || req.method === "HEAD") {
    return json({ ok: true, endpoint: endpoint.label, provider: endpoint.provider, ready: true });
  }

  if (req.method !== "POST" && req.method !== "PUT") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const started = Date.now();
  const res = await handleManyreachWebhook(req, {
    endpoint: `hook:${endpoint.label}`,
    preAuthorized: true,
  });

  // Delivery bookkeeping — never blocks the response.
  const bump = admin.rpc("noop").then(() => {}).catch(() => {});
  void bump;
  admin
    .from("webhook_endpoints")
    .update({
      last_used_at: new Date().toISOString(),
      last_status: res.status,
      hit_count: (await admin
        .from("webhook_endpoints")
        .select("hit_count")
        .eq("id", endpoint.id)
        .maybeSingle()).data?.hit_count ?? 0 + 1,
    })
    .eq("id", endpoint.id)
    .then(() => {}, () => {});

  console.log(`[hook] ${endpoint.label} → ${res.status} in ${Date.now() - started}ms`);
  return res;
});
