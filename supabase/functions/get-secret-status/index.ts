// Reports which of the known secrets are configured (names only, no values).
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const NAMES = [
  "MANYREACH_API_KEY", "INBOX_WEBHOOK_SECRET",
  "NETLIFY_API_TOKEN", "NETLIFY_SITE_ID",
  "SITE_URL", "SITE_DOMAIN",
  "VAPI_API_KEY", "OPENROUTER_API_KEY",
];
Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const status = NAMES.map((n) => ({ name: n, configured: !!Deno.env.get(n) }));
  return new Response(JSON.stringify({ status }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});