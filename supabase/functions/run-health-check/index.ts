// End-to-end system health check.
// Groups: integrations, pipeline, memory, data sync, demo jobs.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkFirecrawl } from "../_shared/firecrawl.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const TEST_EMAIL = "healthcheck-test@example.com";

type Status = "pass" | "fail" | "warn";
type Result = {
  step: string;
  label: string;
  group: string;
  status: Status;
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

type Out = { ok: boolean; warn?: boolean; detail: any; error?: string | null };

function timed(step: string, label: string, group: string, fn: () => Promise<Out>) {
  return async (): Promise<Result> => {
    const t0 = Date.now();
    try {
      const out = await fn();
      const r: Result = {
        step, label, group,
        status: out.ok ? (out.warn ? "warn" : "pass") : "fail",
        duration_ms: Date.now() - t0,
        response_detail: out.detail,
        error_message: out.ok && !out.warn ? null : (out.error || (out.ok ? "degraded" : "failed")),
      };
      await record(r);
      return r;
    } catch (e) {
      const r: Result = {
        step, label, group, status: "fail", duration_ms: Date.now() - t0,
        response_detail: null, error_message: String((e as any)?.message || e),
      };
      await record(r);
      return r;
    }
  };
}

async function fn(path: string, body: any) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* */ }
  return { ok: r.ok, status: r.status, body: json ?? text };
}

// ─────────── Integrations ───────────

const testFirecrawl = timed("firecrawl", "Firecrawl (mandatory for demos)", "integrations", async () => {
  const h = await checkFirecrawl();
  return {
    ok: h.ok,
    detail: h,
    error: h.error,
  };
});

const testOpenRouter = timed("openrouter", "OpenRouter / LLM", "integrations", async () => {
  const key = Deno.env.get("OPENROUTER_API_KEY") || "";
  if (!key) return { ok: false, detail: null, error: "OPENROUTER_API_KEY not set" };
  const r = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${key}` } });
  const text = await r.text();
  let body: any = null; try { body = JSON.parse(text); } catch { /* */ }
  if (r.status === 401 || r.status === 403) return { ok: false, detail: { status: r.status }, error: `auth failed (${r.status})` };
  if (r.status === 429) return { ok: true, warn: true, detail: { status: 429 }, error: "rate limited" };
  const d = body?.data ?? {};
  const limit = d.limit ?? null, usage = d.usage ?? null;
  const exhausted = limit != null && usage != null && usage >= limit;
  return {
    ok: r.ok, warn: exhausted,
    detail: { status: r.status, usage, limit, limit_remaining: d.limit_remaining ?? null, is_free_tier: d.is_free_tier ?? null },
    error: exhausted ? "credit limit reached" : (r.ok ? null : `HTTP ${r.status}`),
  };
});

const testLovableAI = timed("lovable_ai", "Lovable AI Gateway", "integrations", async () => {
  const key = Deno.env.get("LOVABLE_API_KEY") || "";
  if (!key) return { ok: false, detail: null, error: "LOVABLE_API_KEY not set" };
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: [{ role: "user", content: "ping" }], max_tokens: 5 }),
  });
  const text = await r.text();
  if (r.status === 429) return { ok: true, warn: true, detail: { status: 429 }, error: "rate limited" };
  if (r.status === 402) return { ok: false, detail: { status: 402 }, error: "AI credits exhausted" };
  return { ok: r.ok, detail: { status: r.status, sample: text.slice(0, 160) }, error: r.ok ? null : `HTTP ${r.status}` };
});

const testVapi = timed("vapi", "VAPI voice agents", "integrations", async () => {
  const key = Deno.env.get("VAPI_API_KEY") || "";
  if (!key) return { ok: false, detail: null, error: "VAPI_API_KEY not set" };
  const r = await fetch("https://api.vapi.ai/assistant?limit=1", { headers: { Authorization: `Bearer ${key}` } });
  const text = await r.text().catch(() => "");
  if (r.status === 401 || r.status === 403) return { ok: false, detail: { status: r.status }, error: `auth failed (${r.status})` };
  if (r.status === 429) return { ok: true, warn: true, detail: { status: 429 }, error: "rate limited" };
  return { ok: r.ok, detail: { status: r.status, sample: text.slice(0, 160) }, error: r.ok ? null : `HTTP ${r.status}` };
});

const testManyReach = timed("manyreach", "ManyReach outbound", "integrations", async () => {
  const key = Deno.env.get("MANYREACH_API_KEY") || "";
  if (!key) return { ok: false, detail: null, error: "MANYREACH_API_KEY not set" };
  const r = await fetch("https://api.manyreach.com/api/v2/campaigns", { method: "GET", headers: { "X-API-Key": key } });
  const text = await r.text().catch(() => "");
  if (r.status === 401 || r.status === 403) return { ok: false, detail: { status: r.status, body: text.slice(0, 200) }, error: `auth failed (${r.status})` };
  if (r.status === 429) return { ok: true, warn: true, detail: { status: 429 }, error: "rate limited" };
  return { ok: true, detail: { status: r.status, sample: text.slice(0, 200) }, error: null };
});

const testNetlify = timed("netlify", "Netlify deploys", "integrations", async () => {
  const token = Deno.env.get("NETLIFY_API_TOKEN") || "";
  const siteId = Deno.env.get("NETLIFY_SITE_ID") || "";
  if (!token) return { ok: false, detail: { site_id_set: !!siteId }, error: "NETLIFY_API_TOKEN not set" };
  const r = await fetch(`https://api.netlify.com/api/v1/sites${siteId ? `/${siteId}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await r.text().catch(() => "");
  if (r.status === 401 || r.status === 403) return { ok: false, detail: { status: r.status }, error: `auth failed (${r.status})` };
  return { ok: r.ok, detail: { status: r.status, site_id_set: !!siteId, sample: text.slice(0, 160) }, error: r.ok ? null : `HTTP ${r.status}` };
});

const testSecrets = timed("secrets", "Required secrets", "integrations", async () => {
  const required = [
    "INBOX_WEBHOOK_SECRET", "OPENROUTER_API_KEY", "MANYREACH_API_KEY",
    "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL", "FIRECRAWL_API_KEY",
    "VAPI_API_KEY", "SITE_URL",
  ];
  const status: Record<string, boolean> = {};
  for (const k of required) status[k] = !!Deno.env.get(k);
  const missing = Object.entries(status).filter(([, v]) => !v).map(([k]) => k);
  return { ok: missing.length === 0, detail: status, error: missing.length ? `missing: ${missing.join(", ")}` : null };
});

// ─────────── Pipeline ───────────

const testWebhook = timed("webhook", "Inbound webhook", "pipeline", async () => {
  const secret = Deno.env.get("INBOX_WEBHOOK_SECRET") || "";
  const url = `${SUPABASE_URL}/functions/v1/webhook-manyreach-reply?secret=${encodeURIComponent(secret)}`;
  const payload = {
    body: {
      messageId: `healthcheck-${Date.now()}`,
      message: "health check ping",
      prospect: { email: TEST_EMAIL, firstname: "Health", company: "Health Check Test Co", www: "https://example.com" },
      campaign: { campaignID: "HC", campaignTitle: "Health Check" },
      sender_email: "noreply@example.com",
    },
  };
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const text = await r.text();
  return { ok: r.ok, detail: { status: r.status, body: text.slice(0, 300) }, error: r.ok ? null : `HTTP ${r.status}` };
});

const testDbWrite = timed("db_write", "Message storage", "pipeline", async () => {
  await new Promise((r) => setTimeout(r, 800));
  const { data: p } = await supabase.from("prospects").select("id, email, created_at").eq("email", TEST_EMAIL).maybeSingle();
  if (!p) return { ok: false, detail: { found: false }, error: "test prospect not found in DB" };
  const { data: m } = await supabase.from("inbox_messages").select("id, body, created_at")
    .eq("prospect_id", p.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return { ok: !!m, detail: { prospect: p, latest_message: m }, error: m ? null : "no message row for test prospect" };
});

const testClassify = timed("classify", "AI classification", "pipeline", async () => {
  const { data: p } = await supabase.from("prospects").select("id").eq("email", TEST_EMAIL).maybeSingle();
  if (!p) return { ok: false, detail: null, error: "run webhook test first" };
  const { data: m } = await supabase.from("inbox_messages").insert({
    prospect_id: p.id, direction: "incoming", source: "email",
    subject: "health check", body: "yes I'm interested, send me the link", is_test_data: true,
  }).select("id").single();
  if (!m) return { ok: false, detail: null, error: "could not insert test message" };
  const r = await fn("inbox-classify", { prospect_id: p.id, message_id: m.id });
  const cls = r.body?.classification;
  const ok = r.ok && ["Positive", "Negative", "Objection"].includes(cls);
  return { ok, detail: r.body, error: ok ? null : `bad output: ${JSON.stringify(r.body).slice(0, 200)}` };
});

const testGenerateReply = timed("generate_reply", "Reply generation", "pipeline", async () => {
  const { data: p } = await supabase.from("prospects").select("id").eq("email", TEST_EMAIL).maybeSingle();
  if (!p) return { ok: false, detail: null, error: "run webhook test first" };
  const r = await fn("inbox-generate-reply", {
    prospect_id: p.id, classification: "Positive",
    demo_url: "https://aiagentfor.lovable.app/healthcheck-demo",
  });
  const reply = r.body?.reply;
  return { ok: r.ok && !!reply, detail: r.body, error: reply ? null : "no reply generated" };
});

const testCreateDemo = timed("create_demo", "Demo generation", "pipeline", async () => {
  const health = await checkFirecrawl();
  if (!health.ok) {
    return { ok: false, detail: { firecrawl: health }, error: `blocked: Firecrawl not healthy (${health.error})` };
  }
  const r = await fn("create-demo", { business_name: "Health Check Test Co", website_url: "https://example.com" });
  const url = r.body?.demo_url;
  return { ok: r.ok && !!url, detail: r.body, error: url ? null : `missing demo_url (${JSON.stringify(r.body).slice(0, 200)})` };
});

// ─────────── Memory / history ───────────

const testMemory = timed("memory", "Lead memory read/write", "memory", async () => {
  const { data: p } = await supabase.from("prospects").select("id").eq("email", TEST_EMAIL).maybeSingle();
  if (!p) return { ok: false, detail: null, error: "run webhook test first" };

  const { error: upErr } = await supabase.from("prospect_memory").upsert({
    prospect_id: p.id, conversation_stage: "health_check", updated_at: new Date().toISOString(),
  }, { onConflict: "prospect_id" });
  if (upErr) return { ok: false, detail: { write: upErr.message }, error: `memory write failed: ${upErr.message}` };

  const { data: mem } = await supabase.from("prospect_memory").select("*").eq("prospect_id", p.id).maybeSingle();
  const { count: memRows } = await supabase.from("prospect_memory").select("id", { count: "exact", head: true });
  const { count: reads } = await supabase.from("pipeline_events").select("id", { count: "exact", head: true })
    .eq("step", "memory_read").gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString());

  return {
    ok: !!mem,
    warn: (reads ?? 0) === 0,
    detail: { memory_rows: memRows ?? 0, memory_reads_7d: reads ?? 0, sample_stage: mem?.conversation_stage ?? null },
    error: !mem ? "memory read returned nothing" : ((reads ?? 0) === 0 ? "no memory_read events in the last 7 days — history may not be feeding the AI" : null),
  };
});

const testHistory = timed("history", "Thread history completeness", "memory", async () => {
  const { count: prospects } = await supabase.from("prospects").select("id", { count: "exact", head: true });
  const { count: incoming } = await supabase.from("inbox_messages").select("id", { count: "exact", head: true }).eq("direction", "incoming");
  const { count: outgoing } = await supabase.from("inbox_messages").select("id", { count: "exact", head: true }).eq("direction", "outgoing");
  const { count: classified } = await supabase.from("inbox_messages").select("id", { count: "exact", head: true })
    .eq("direction", "incoming").not("classification", "is", null);
  const unclassified = (incoming ?? 0) - (classified ?? 0);
  return {
    ok: (incoming ?? 0) > 0,
    warn: unclassified > 0,
    detail: { prospects: prospects ?? 0, incoming: incoming ?? 0, outgoing: outgoing ?? 0, classified: classified ?? 0, unclassified },
    error: (incoming ?? 0) === 0 ? "no incoming messages stored" : (unclassified > 0 ? `${unclassified} incoming messages are unclassified` : null),
  };
});

// ─────────── Data sync ───────────

const testDataSync = timed("data_sync", "Inbox / Conversations data sync", "data", async () => {
  const [pr, msg, demos, sess, chatMsgs, enroll, events] = await Promise.all([
    supabase.from("prospects").select("id", { count: "exact", head: true }),
    supabase.from("inbox_messages").select("id", { count: "exact", head: true }),
    supabase.from("inbox_demos").select("id", { count: "exact", head: true }),
    supabase.from("chatbot_sessions").select("id", { count: "exact", head: true }),
    supabase.from("chatbot_messages").select("id", { count: "exact", head: true }),
    supabase.from("follow_up_enrollments").select("id", { count: "exact", head: true }),
    supabase.from("pipeline_events").select("id", { count: "exact", head: true }),
  ]);
  const detail = {
    prospects: pr.count ?? 0, inbox_messages: msg.count ?? 0, inbox_demos: demos.count ?? 0,
    chatbot_sessions: sess.count ?? 0, chatbot_messages: chatMsgs.count ?? 0,
    follow_up_enrollments: enroll.count ?? 0, pipeline_events: events.count ?? 0,
  };
  const empty = Object.entries(detail).filter(([, v]) => v === 0).map(([k]) => k);
  return { ok: (msg.count ?? 0) > 0, warn: empty.length > 0, detail, error: empty.length ? `empty tables: ${empty.join(", ")}` : null };
});

const testAdminData = timed("admin_data", "Admin data API (dashboard reads)", "data", async () => {
  const r = await fn("admin-data", { resource: "overview", admin_key: Deno.env.get("ADMIN_PANEL_PASSWORD") || "Abhiraj@123" });
  const ok = r.ok && !!r.body?.data?.stats;
  return { ok, detail: ok ? r.body.data.stats : r.body, error: ok ? null : "admin-data did not return overview stats" };
});

const testDemoJobs = timed("demo_jobs", "Demo job failures", "data", async () => {
  const { data: failed } = await supabase.from("demo_jobs")
    .select("id, business_name, status, last_error, created_at")
    .in("status", ["failed", "partial"]).order("created_at", { ascending: false }).limit(10);
  const n = (failed ?? []).length;
  return { ok: true, warn: n > 0, detail: { failed_jobs: n, jobs: failed ?? [] }, error: n ? `${n} demo job(s) need a retry` : null };
});

const STEPS: Record<string, () => Promise<Result>> = {
  firecrawl: testFirecrawl,
  openrouter: testOpenRouter,
  lovable_ai: testLovableAI,
  vapi: testVapi,
  manyreach: testManyReach,
  netlify: testNetlify,
  secrets: testSecrets,
  webhook: testWebhook,
  db_write: testDbWrite,
  classify: testClassify,
  generate_reply: testGenerateReply,
  create_demo: testCreateDemo,
  memory: testMemory,
  history: testHistory,
  data_sync: testDataSync,
  admin_data: testAdminData,
  demo_jobs: testDemoJobs,
};

const ORDER = [
  "firecrawl", "openrouter", "lovable_ai", "vapi", "manyreach", "netlify", "secrets",
  "webhook", "db_write", "classify", "generate_reply",
  "memory", "history", "data_sync", "admin_data", "demo_jobs",
];
// create_demo is opt-in (it really builds a demo) — run it explicitly.

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
