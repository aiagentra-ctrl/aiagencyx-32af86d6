// Service-role read layer for the admin panel.
// The panel authenticates with a shared admin key (the hardcoded panel password),
// so it runs as `anon` against Postgres and every table's RLS blocks it.
// This function does the reads with the service role AFTER validating the key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const ADMIN_KEY = Deno.env.get("ADMIN_PANEL_PASSWORD") || "Abhiraj@123";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const iso = (ms: number) => new Date(Date.now() - ms).toISOString();
const DAY = 86_400_000;

async function count(table: string, build?: (q: any) => any) {
  let q = sb.from(table).select("id", { count: "exact", head: true });
  if (build) q = build(q);
  const { count: c } = await q;
  return c ?? 0;
}

const RESOURCES: Record<string, (p: any) => Promise<unknown>> = {
  // ── Inbox ────────────────────────────────────────────────
  inbox: async () => {
    const [ps, ms, ds, pe] = await Promise.all([
      sb.from("prospects").select("*").eq("is_test_data", false)
        .order("last_message_at", { ascending: false, nullsFirst: false }).limit(500),
      sb.from("inbox_messages").select("*").eq("is_test_data", false)
        .order("created_at", { ascending: true }).limit(2000),
      sb.from("inbox_demos").select("*").order("created_at", { ascending: false }).limit(500),
      sb.from("pipeline_events").select("id, message_id, prospect_id, step, status, details, created_at")
        .order("created_at", { ascending: false }).limit(500),
    ]);
    return { prospects: ps.data ?? [], messages: ms.data ?? [], demos: ds.data ?? [], pipeline_events: pe.data ?? [] };
  },

  // ── Conversations ────────────────────────────────────────
  conversations: async () => {
    const [sessions, suggestions] = await Promise.all([
      sb.from("chatbot_sessions").select("*")
        .order("last_message_at", { ascending: false, nullsFirst: false }).limit(100),
      sb.from("prompt_improvement_suggestions").select("*")
        .order("created_at", { ascending: false }).limit(50),
    ]);
    return { sessions: sessions.data ?? [], suggestions: suggestions.data ?? [] };
  },
  conversation_messages: async (p) => {
    const { data } = await sb.from("chatbot_messages").select("*")
      .eq("session_id", p?.session_id).order("created_at", { ascending: true });
    return { messages: data ?? [] };
  },

  // ── Leads / Tracking ─────────────────────────────────────
  leads: async () => {
    const [prospects, demos, enrollments] = await Promise.all([
      sb.from("prospects").select("*").eq("is_test_data", false)
        .order("created_at", { ascending: false }).limit(500),
      sb.from("inbox_demos").select("*").order("created_at", { ascending: false }).limit(500),
      sb.from("follow_up_enrollments").select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    return { prospects: prospects.data ?? [], demos: demos.data ?? [], enrollments: enrollments.data ?? [] };
  },
  // Legacy `leads` table (slug-based) used by the Leads panel.
  leads_legacy: async () => {
    const [leads, events] = await Promise.all([
      sb.from("leads").select("*").order("updated_at", { ascending: false }).limit(500),
      sb.from("link_events").select("slug, business_name, event_type, country_code, metadata").limit(5000),
    ]);
    return { leads: leads.data ?? [], link_events: events.data ?? [] };
  },

  tracking: async () => {
    const [prospects, events, enrollments] = await Promise.all([
      sb.from("prospects").select("*").eq("is_test_data", false).eq("is_self_traffic", false)
        .order("last_activity_at", { ascending: false, nullsFirst: false }).limit(500),
      sb.from("link_events").select("id, slug, event_type, link_type, country_code, created_at, is_self_traffic")
        .eq("is_self_traffic", false).order("created_at", { ascending: false }).limit(1000),
      sb.from("follow_up_enrollments").select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    return { prospects: prospects.data ?? [], link_events: events.data ?? [], enrollments: enrollments.data ?? [] };
  },

  // ── Home / Dashboard overview ────────────────────────────
  overview: async () => {
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const today = dayStart.toISOString();
    const last7 = iso(7 * DAY);
    const last24 = iso(DAY);

    const [
      demos, chatbots, prospects, hotLeads, sessions,
      messages7, repliesToday, outboundToday, queued, sentFollowups7, errors24, bookings, demoOpens7,
      recentMessages, recentSessions, recentActivity, recentJobs, failedJobs, notifications,
    ] = await Promise.all([
      count("demo_pages"),
      count("chatbots"),
      count("prospects", (q) => q.eq("is_test_data", false)),
      count("prospects", (q) => q.eq("is_hot_lead", true)),
      count("chatbot_sessions"),
      count("inbox_messages", (q) => q.gte("created_at", last7)),
      count("inbox_messages", (q) => q.eq("direction", "incoming").gte("created_at", today)),
      count("inbox_messages", (q) => q.eq("direction", "outgoing").gte("created_at", today)),
      count("follow_up_enrollments", (q) => q.in("status", ["active", "scheduled", "sending"])),
      count("followup_events", (q) => q.eq("status", "sent").gte("sent_at", last7)),
      count("error_events", (q) => q.gte("created_at", last24)),
      count("prospects", (q) => q.not("calendly_booked_at", "is", null)),
      count("demo_open_log", (q) => q.gte("opened_at", last7)),
      sb.from("inbox_messages").select("id, prospect_id, direction, subject, body, classification, created_at")
        .order("created_at", { ascending: false }).limit(8),
      sb.from("chatbot_sessions").select("id, business_name, session_id, total_messages, outcome, sentiment, last_message_at")
        .order("last_message_at", { ascending: false, nullsFirst: false }).limit(6),
      sb.from("activity_logs").select("id, event_type, status, message, created_at")
        .order("created_at", { ascending: false }).limit(8),
      sb.from("demo_jobs").select("id, business_name, status, last_error, created_at")
        .order("created_at", { ascending: false }).limit(6),
      count("demo_jobs", (q) => q.in("status", ["failed", "partial"])),
      sb.from("notifications").select("id, type, message, read, created_at")
        .eq("read", false).order("created_at", { ascending: false }).limit(6),
    ]);

    // Funnel counts (engagement columns live on prospects)
    const [opened, triedVoice, triedChat, calendlyClicked] = await Promise.all([
      count("prospects", (q) => q.not("demo_page_opened_at", "is", null)),
      count("prospects", (q) => q.not("voice_tried_at", "is", null)),
      count("prospects", (q) => q.not("chatbot_tried_at", "is", null)),
      count("prospects", (q) => q.not("calendly_clicked_at", "is", null)),
    ]);

    // 7-day message trend
    const { data: trendRows } = await sb.from("inbox_messages")
      .select("direction, created_at").gte("created_at", last7).limit(5000);
    const buckets: Record<string, { incoming: number; outgoing: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * DAY).toISOString().slice(0, 10);
      buckets[d] = { incoming: 0, outgoing: 0 };
    }
    for (const r of trendRows ?? []) {
      const d = String(r.created_at).slice(0, 10);
      if (!buckets[d]) continue;
      if (r.direction === "incoming") buckets[d].incoming++;
      else buckets[d].outgoing++;
    }
    const trend = Object.entries(buckets).map(([day, v]) => ({ day, ...v }));

    return {
      stats: {
        demos, chatbots, prospects, hotLeads, sessions,
        messages7, repliesToday, outboundToday, queued, sentFollowups7,
        errors24, bookings, demoOpens7, failedJobs,
      },
      funnel: { total: prospects, opened, triedVoice, triedChat, calendlyClicked, booked: bookings },
      trend,
      recent: {
        messages: recentMessages.data ?? [],
        sessions: recentSessions.data ?? [],
        activity: recentActivity.data ?? [],
        jobs: recentJobs.data ?? [],
        notifications: notifications.data ?? [],
      },
    };
  },

  // ── Lead sync (write path — RLS blocks the panel otherwise) ──
  sync_leads: async () => {
    const EXCLUDED = ["NP", "IN", "BD"];
    const [{ data: events }, { data: existingLeads }] = await Promise.all([
      sb.from("link_events").select("slug, business_name, event_type, country_code, metadata").limit(5000),
      sb.from("leads").select("slug, status, follow_up_count"),
    ]);
    if (!events?.length) return { processed: 0, skipped: 0 };

    const slugMap = new Map<string, { business_name: string; events: string[]; countryCodes: string[]; hasOwnerTraffic: boolean }>();
    for (const e of events as any[]) {
      const entry = slugMap.get(e.slug) || { business_name: e.business_name, events: [], countryCodes: [], hasOwnerTraffic: false };
      entry.events.push(e.event_type);
      if (e.country_code) entry.countryCodes.push(e.country_code);
      if ((e.metadata as any)?.is_owner) entry.hasOwnerTraffic = true;
      slugMap.set(e.slug, entry);
    }
    const existingMap = new Map((existingLeads ?? []).map((l: any) => [l.slug, l]));

    let processed = 0, skipped = 0;
    for (const [slug, info] of slugMap) {
      const valid = info.countryCodes.filter((c) => !EXCLUDED.includes(c));
      const allExcluded = info.countryCodes.length > 0 && valid.length === 0;
      const isOnlyOwner = info.hasOwnerTraffic && valid.length === 0;
      if ((allExcluded || isOnlyOwner) && !existingMap.has(slug)) { skipped++; continue; }

      const existing = existingMap.get(slug) as any;
      if (existing && existing.status === "call_scheduled") continue;

      let status = "needs_follow_up";
      const evts = info.events;
      if (evts.includes("voice_call_started")) status = "interested";
      else if (evts.includes("chatbot_opened") || evts.includes("chatbot_message")) status = "awaiting_response";
      const clicks = evts.filter((e) => e === "click" || e === "cta_click").length;
      if (clicks >= 3 || evts.length >= 5) status = "engaged";
      if (existing && existing.follow_up_count >= 3 && status === "needs_follow_up") status = "cold_lead";

      if (existing) {
        if (existing.status !== status) await sb.from("leads").update({ status }).eq("slug", slug);
      } else {
        await sb.from("leads").insert({ slug, business_name: info.business_name, status });
      }
      processed++;
    }
    return { processed, skipped };
  },

  // ── Demo jobs (health / retry) ───────────────────────────
  demo_jobs: async (p) => {
    let q = sb.from("demo_jobs").select("*").order("created_at", { ascending: false }).limit(p?.limit ?? 25);
    if (p?.status) q = q.in("status", Array.isArray(p.status) ? p.status : [p.status]);
    const { data: jobs } = await q;
    const ids = (jobs ?? []).map((j: any) => j.id);
    const { data: steps } = ids.length
      ? await sb.from("demo_job_steps").select("*").in("job_id", ids).order("step_order")
      : { data: [] as any[] };
    return { jobs: jobs ?? [], steps: steps ?? [] };
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const key = req.headers.get("x-admin-key") || body?.admin_key || "";
    if (key !== ADMIN_KEY) return json({ error: "unauthorized" }, 401);

    const resource = String(body?.resource || "");
    const runner = RESOURCES[resource];
    if (!runner) return json({ error: `unknown resource: ${resource}` }, 400);

    const data = await runner(body?.params ?? {});
    return json({ resource, data });
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
