// Returns the full ManyReach webhook URL (including the secret query param).
// Secret is read server-side so it NEVER ships in the frontend bundle —
// only logged-in dashboard users can fetch this.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const base = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");
    const secret = Deno.env.get("INBOX_WEBHOOK_SECRET") || "";
    const url = `${base}/functions/v1/webhook-manyreach-reply?secret=${encodeURIComponent(secret)}`;

    return new Response(JSON.stringify({ url, has_secret: !!secret }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});