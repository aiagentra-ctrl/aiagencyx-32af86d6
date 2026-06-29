// Developer tool: posts a sample ManyReach payload to the real webhook endpoint
// and returns the live response so admins can verify wiring without Postman.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const WEBHOOK_SECRET = Deno.env.get("INBOX_WEBHOOK_SECRET")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const overrides = await req.json().catch(() => ({}));
    const sample = {
      messageId: `test-${crypto.randomUUID()}`,
      subject: "Re: Quick question",
      body: overrides.body ?? "This sounds interesting, can you tell me more?",
      prospect: {
        email: overrides.email ?? "dev-test@example.com",
        firstName: overrides.firstname ?? "Dev",
        company: overrides.company ?? "Test Co",
        website: overrides.website ?? "https://example.com",
      },
      campaignId: overrides.campaignId ?? "TEST-CAMPAIGN",
      campaignName: overrides.campaignName ?? "Dev Test Campaign",
      senderEmail: overrides.senderEmail ?? "you@yourdomain.com",
      replyToEmail: overrides.replyToEmail ?? "you@yourdomain.com",
      ...overrides,
    };

    const url = `${SUPABASE_URL}/functions/v1/webhook-manyreach-reply?key=${encodeURIComponent(WEBHOOK_SECRET)}`;
    const t0 = Date.now();
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sample),
    });
    const ms = Date.now() - t0;
    const text = await r.text();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch { /* ignore */ }

    return new Response(JSON.stringify({
      status_code: r.status, ok: r.ok, response_ms: ms,
      body: parsed ?? text, payload_sent: sample,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
