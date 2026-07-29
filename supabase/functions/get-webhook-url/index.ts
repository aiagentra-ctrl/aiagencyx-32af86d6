// Returns the full ManyReach webhook URL (including the secret query param).
// Secret is read server-side so it NEVER ships in the frontend bundle —
// only logged-in dashboard users can fetch this.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const base = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");
    const secret = Deno.env.get("INBOX_WEBHOOK_SECRET") || "";
    const url = `${base}/functions/v1/webhook-manyreach-reply?secret=${encodeURIComponent(secret)}`;
    const short_url = `${base}/functions/v1/mr/${encodeURIComponent(secret)}`;

    // Preferred: the first active registered endpoint from the token registry.
    let hook_url = "";
    try {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data } = await admin
        .from("webhook_endpoints").select("token")
        .eq("active", true).order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (data?.token) hook_url = `${base}/functions/v1/hook/${data.token}`;
    } catch { /* registry optional */ }

    return new Response(JSON.stringify({ hook_url, url, short_url, legacy_url: url, has_secret: !!secret }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});