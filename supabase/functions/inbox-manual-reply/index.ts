// Manual reply from the dashboard.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { prospect_id, body, subject } = await req.json();
    if (!prospect_id || !body) {
      return new Response(JSON.stringify({ error: "prospect_id and body required" }), { status: 400, headers: corsHeaders });
    }
    const r = await fetch(`${SUPABASE_URL}/functions/v1/inbox-send-reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ prospect_id, body, subject, classified_by: "human" }),
    });
    const text = await r.text();
    return new Response(text, { status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: corsHeaders });
  }
});
