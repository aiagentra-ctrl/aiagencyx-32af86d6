// End-to-end pipeline health check. Tests each step individually or all at once.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const TEST_EMAIL = "healthcheck-test@example.com";

type Result = {
  step: string;
  status: "pass" | "fail";
  duration_ms: number;
  response_detail: any;
  error_message: string | null;
};

async function record(r: Result) {
  try {
    await supabase.from("system_health_checks").insert({
      step_name: r.step,
      status: r.status,
      response_detail: r.response_detail,
      error_message: r.error_message,
      duration_ms: r.duration_ms,
    });
  } catch (e) {
    console.error("record failed:", e);
  }
}

async function timed<T>(step: string, fn: () => Promise<{ ok: boolean; detail: any; error?: string | null }>): Promise<Result> {
  const t0 = Date.now();
  try {
    const out = await fn();
    const r: Result = {
      step,
      status: out.ok ? "pass" : "fail",
      duration_ms: Date.now() - t0,
      response_detail: out.detail,
      error_message: out.ok ? null : (out.error || "failed"),
    };
    await record(r);
    return r;
  } catch (e) {
    const r: Result = {
      step, status: "fail", duration_ms: Date.now() - t0,
      response_detail: null,
      error_message: String((e as any)?.message || e),
    };
    await record(r);
    return r;
  }
}

async function fn(path: string, body: any) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* */ }
  return { ok: r.ok, status: r.status, body: json ?? text };
}

// ----------- Per-step tests -----------

async function testWebhook() {
  return timed("webhook", async () => {
    const secret = Deno.env.get("INBOX_WEBHOOK_SECRET") || "";
    const url = `${SUPABASE_URL}/functions/v1/webhook-manyreach-reply?secret=${encodeURIComponent(secret)}`;
    const payload = {
      body: {
        messageId: `healthcheck-${Date.now()}`,
        message: "health check ping",
        prospect: {
          email: TEST_EMAIL,
          firstname: "Health",
          company: "Health Check Test Co",
          www: "https://example.com",
        },
        campaign: { campaignID: "HC", campaignTitle: "Health Check" },
        sender_email: "noreply@example.com",
      },
    };
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await r.text();
    return { ok: r.ok, detail: { status: r.status, body: text }, error: r.ok ? null : `HTTP ${r.status}` };
  });
}

async function testDbWrite() {
  return timed("db_write", async () => {
    // Allow a moment for the webhook insert to land.
    await new Promise((r) => setTimeout(r, 800));
    const { data: p } = await supabase
      .from("prospects").select("id, email, created_at").eq("email", TEST_EMAIL).maybeSingle();
    if (!p) return { ok: false, detail: { found: false }, error: "test prospect not found in DB" };
    const { data: m } = await supabase
      .from("inbox_messages").select("id, body, created_at")
      .eq("prospect_id", p.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    return { ok: !!m, detail: { prospect: p, latest_message: m }, error: m ? null : "no message row for test prospect" };
  });
}

async function testClassify() {
  return timed("classify", async () => {
    // Make sure we have a test prospect + message to classify.
    const { data: p } = await supabase.from("prospects").select("id").eq("email", TEST_EMAIL).maybeSingle();
    if (!p) return { ok: false, detail: null, error: "run webhook test first" };
    const { data: m } = await supabase.from("inbox_messages").insert({
      prospect_id: p.id, direction: "incoming", source: "email",
      subject: "health check", body: "yes I'm interested, send me the link",
      is_test_data: true,
    }).select("id").single();
    if (!m) return { ok: false, detail: null, error: "could not insert test message" };
    const r = await fn("inbox-classify", { prospect_id: p.id, message_id: m.id });
    const cls = r.body?.classification;
    const ok = r.ok && ["Positive", "Negative", "Objection"].includes(cls);
    return { ok, detail: r.body, error: ok ? null : `bad output: ${JSON.stringify(r.body)}` };
  });
}

async function testCreateDemo() {
  return timed("create_demo", async () => {
    const r = await fn("create-demo", {
      business_name: "Health Check Test Co",
      website_url: "https://example.com",
    });
    const url = r.body?.demo_url;
    return { ok: r.ok && !!url, detail: r.body, error: url ? null : "missing demo_url in response" };
  });
}

async function testGenerateReply() {
  return timed("generate_reply", async () => {
    const { data: p } = await supabase.from("prospects").select("id").eq("email", TEST_EMAIL).maybeSingle();
    if (!p) return { ok: false, detail: null, error: "run webhook test first" };
    const r = await fn("inbox-generate-reply", {
      prospect_id: p.id,
      classification: "Positive",
      demo_url: "https://aiagentfor.lovable.app/healthcheck-demo",
    });
    const reply = r.body?.reply;
    return { ok: r.ok && !!reply, detail: r.body, error: reply ? null : "no reply generated" };
  });
}

async function testManyReach() {
  return timed("manyreach", async () => {
    const key = Deno.env.get("MANYREACH_API_KEY") || "";
    if (!key) return { ok: false, detail: null, error: "MANYREACH_API_KEY not set" };
    // Lightweight auth check: GET a non-destructive endpoint.
    const r = await fetch("https://api.manyreach.com/api/v2/campaigns", {
      method: "GET",
      headers: { "X-API-Key": key },
    });
    const text = await r.text().catch(() => "");
    if (r.status === 401 || r.status === 403) {
      return { ok: false, detail: { status: r.status, body: text.slice(0, 200) }, error: `auth failed (${r.status})` };
    }
    // Any non-401/403 = key recognised. Even 404/405 means we reached ManyReach.
    return { ok: true, detail: { status: r.status, sample: text.slice(0, 200) }, error: null };
  });
}

async function testSecrets() {
  return timed("secrets", async () => {
    const required = ["INBOX_WEBHOOK_SECRET", "LOVABLE_API_KEY", "MANYREACH_API_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL"];
    const status: Record<string, boolean> = {};
    for (const k of required) status[k] = !!Deno.env.get(k);
    const missing = Object.entries(status).filter(([, v]) => !v).map(([k]) => k);
    return {
      ok: missing.length === 0,
      detail: status,
      error: missing.length === 0 ? null : `missing: ${missing.join(", ")}`,
    };
  });
}

const STEPS: Record<string, () => Promise<Result>> = {
  webhook: testWebhook,
  db_write: testDbWrite,
  classify: testClassify,
  create_demo: testCreateDemo,
  generate_reply: testGenerateReply,
  manyreach: testManyReach,
  secrets: testSecrets,
};

const ORDER = ["webhook", "db_write", "classify", "create_demo", "generate_reply", "manyreach", "secrets"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { step } = await req.json().catch(() => ({ step: "all" }));
    if (step && step !== "all") {
      const runner = STEPS[step];
      if (!runner) {
        return new Response(JSON.stringify({ error: `unknown step: ${step}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const r = await runner();
      return new Response(JSON.stringify({ results: [r] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const results: Result[] = [];
    for (const name of ORDER) results.push(await STEPS[name]());
    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});