import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { engagementTier, isSelfTrafficCountry } from "../_shared/geo.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const BOT = /bot|crawl|spider|slurp|headless|phantom|selenium|puppeteer|playwright|wget|curl|python-requests|axios|node-fetch/i;

function parseDevice(ua: string) {
  let device = "desktop";
  if (/mobile|android|iphone|ipod|phone|blackberry|iemobile/i.test(ua)) device = "mobile";
  else if (/tablet|ipad|playbook|silk/i.test(ua)) device = "tablet";
  let browser = "unknown";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/chrome/i.test(ua)) browser = "Chrome";
  else if (/safari/i.test(ua)) browser = "Safari";
  else if (/firefox/i.test(ua)) browser = "Firefox";
  let os = "unknown";
  if (/windows/i.test(ua)) os = "Windows";
  else if (/mac os|macintosh/i.test(ua)) os = "macOS";
  else if (/iphone|ipad/i.test(ua)) os = "iOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/linux/i.test(ua)) os = "Linux";
  return { device, browser, os };
}

function computeScore(e: any): { score: number; tier: string } {
  let s = 0;
  s += Math.min(20, Math.round((e.time_seconds || 0) / 6));
  s += Math.min(15, Math.round((e.scroll_depth || 0) * 0.15));
  s += Math.min(15, (e.click_count || 0) * 2);
  if (e.demo_tried) s += 30;
  s += Math.min(10, ((e.return_visits || 0)) * 5);
  if (e.cta_clicks) s += Math.min(10, e.cta_clicks * 3);
  s = Math.max(0, Math.min(100, s));
  const tier = s >= 70 ? "high" : s >= 40 ? "medium" : "low";
  return { score: s, tier };
}

async function loadCountryRules() {
  const { data } = await supabase.from("site_settings").select("key,value").in("key", ["country_allowlist", "country_blocklist"]);
  const map: Record<string, string[]> = { allow: [], block: [] };
  for (const r of data || []) {
    const list = (r.value || "").split(",").map((x: string) => x.trim().toUpperCase()).filter(Boolean);
    if (r.key === "country_allowlist") map.allow = list;
    if (r.key === "country_blocklist") map.block = list;
  }
  return map;
}

async function getDelayHours(key: string, fallback: number): Promise<number> {
  const { data } = await supabase.from("followup_settings").select("value").eq("key", key).maybeSingle();
  const v = parseFloat(data?.value || "");
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

async function enqueueIfMissing(leadId: string, type: "case1" | "case2", scheduledAt: Date, replaceOtherPending = false) {
  // Check existing pending of same type
  const { data: existing } = await supabase.from("email_queue").select("id").eq("lead_id", leadId).eq("type", type).eq("status", "pending").limit(1);
  if (existing && existing.length > 0) return;
  if (replaceOtherPending && type === "case2") {
    // Cancel any pending case1
    await supabase.from("email_queue").update({ status: "cancelled", cancelled_reason: "switched_to_case2", updated_at: new Date().toISOString() })
      .eq("lead_id", leadId).eq("type", "case1").eq("status", "pending");
  }
  await supabase.from("email_queue").insert({ lead_id: leadId, type, scheduled_at: scheduledAt.toISOString() });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { slug, session_id, event_type, metadata = {}, fingerprint } = body;
    if (!slug || !event_type) {
      return new Response(JSON.stringify({ error: "slug and event_type required" }), { status: 400, headers: corsHeaders });
    }

    const ua = req.headers.get("user-agent") || "";
    if (!ua || BOT.test(ua)) return new Response(JSON.stringify({ ok: true, filtered: "bot" }), { headers: corsHeaders });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "unknown";

    let countryCode: string | null = null;
    if (ip && ip !== "unknown" && ip !== "127.0.0.1") {
      try {
        const r = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode,status`, { signal: AbortSignal.timeout(2500) });
        if (r.ok) { const j = await r.json(); if (j?.status === "success") countryCode = (j.countryCode || "").toUpperCase(); }
      } catch { /* ignore */ }
    }

    const rules = await loadCountryRules();
    // Hard rule first: our own countries (NP/IN/BD/PK) never generate tracking.
    if (isSelfTrafficCountry(countryCode)) {
      return new Response(JSON.stringify({ ok: true, filtered: "self_traffic" }), { headers: corsHeaders });
    }
    if (countryCode && rules.block.includes(countryCode)) {
      return new Response(JSON.stringify({ ok: true, filtered: "country_blocked" }), { headers: corsHeaders });
    }
    if (countryCode && rules.allow.length > 0 && !rules.allow.includes(countryCode)) {
      return new Response(JSON.stringify({ ok: true, filtered: "country_not_allowed" }), { headers: corsHeaders });
    }


    const { data: lead } = await supabase.from("demo_leads").select("*").eq("slug", slug).maybeSingle();
    if (!lead) {
      return new Response(JSON.stringify({ ok: true, filtered: "no_lead" }), { headers: corsHeaders });
    }

    if (lead.status === "incomplete" || !lead.is_complete) {
      return new Response(JSON.stringify({ ok: true, filtered: "incomplete_lead" }), { headers: corsHeaders });
    }

    const device = parseDevice(ua);
    const eng = { ...(lead.engagement || {}) };
    eng.device = device.device;
    eng.browser = device.browser;
    eng.os = device.os;
    eng.return_visits = (eng.return_visits || 0) + (event_type === "session_start" && eng.last_session_id && eng.last_session_id !== session_id ? 1 : 0);
    if (session_id) eng.last_session_id = session_id;

    if (typeof metadata.time_seconds === "number") eng.time_seconds = Math.max(eng.time_seconds || 0, metadata.time_seconds);
    if (typeof metadata.scroll_depth === "number") eng.scroll_depth = Math.max(eng.scroll_depth || 0, metadata.scroll_depth);
    if (event_type === "click") eng.click_count = (eng.click_count || 0) + 1;
    if (event_type === "cta_click") eng.cta_clicks = (eng.cta_clicks || 0) + 1;
    if (event_type === "form_submit") eng.form_submits = (eng.form_submits || 0) + 1;
    if (metadata.utm) eng.utm = { ...(eng.utm || {}), ...metadata.utm };

    let demoTried = lead.demo_tried;
    let demoTypeTried = lead.demo_type_tried;
    let triedVoice = lead.tried_voice;
    let triedChat = lead.tried_chat;
    let voiceFirstAt = lead.voice_first_at;
    let chatFirstAt = lead.chat_first_at;
    let voiceJustTried = false;
    let chatJustTried = false;

    if (event_type === "voice_call_started" || event_type === "voice_interaction") {
      demoTried = true; demoTypeTried = "voice"; eng.demo_tried = true;
      if (!triedVoice) { triedVoice = true; voiceFirstAt = new Date().toISOString(); voiceJustTried = true; }
    }
    if (event_type === "chatbot_message_sent" || event_type === "chatbot_interaction") {
      demoTried = true; demoTypeTried = demoTypeTried || "chatbot"; eng.demo_tried = true;
      if (!triedChat) { triedChat = true; chatFirstAt = new Date().toISOString(); chatJustTried = true; }
    }

    // Feedback link tracking
    let fbClicked = lead.feedback_link_clicked;
    let fbClickedAt = lead.feedback_link_clicked_at;
    let fbVisits = lead.feedback_link_visit_count || 0;
    if (event_type === "feedback_clicked") {
      fbVisits++;
      if (!fbClicked) { fbClicked = true; fbClickedAt = new Date().toISOString(); }
    }

    const { score, tier } = computeScore(eng);

    const updates: any = {
      engagement: eng,
      lead_score: score,
      score_tier: tier,
      country_code: countryCode || lead.country_code,
      visitor_session_id: session_id || lead.visitor_session_id,
      last_visit_at: new Date().toISOString(),
      demo_tried: demoTried,
      demo_type_tried: demoTypeTried,
      tried_voice: triedVoice,
      tried_chat: triedChat,
      voice_first_at: voiceFirstAt,
      chat_first_at: chatFirstAt,
      feedback_link_clicked: fbClicked,
      feedback_link_clicked_at: fbClickedAt,
      feedback_link_visit_count: fbVisits,
    };
    if (fingerprint && !lead.fingerprint) updates.fingerprint = fingerprint;
    if (lead.status === "pending" || lead.status === "visited_no_demo") {
      updates.status = demoTried ? "visited_demo_tried" : "visited_no_demo";
    }

    await supabase.from("demo_leads").update(updates).eq("id", lead.id);

    // ── Queue follow-ups ──
    // CASE 1: page visit, no agent tried, has email, not yet sent → schedule
    if (
      !triedVoice && !triedChat &&
      !lead.followup_case1_sent &&
      (lead.sender_email || lead.first_name) // has identity
    ) {
      const delay = await getDelayHours("case1_delay_hours", 24);
      const scheduled = new Date(Date.now() + delay * 3600_000);
      await enqueueIfMissing(lead.id, "case1", scheduled, false);
    }

    // CASE 2: agent just tried for the first time → schedule (and cancel pending case1)
    if ((voiceJustTried || chatJustTried) && !lead.followup_case2_sent) {
      const delay = await getDelayHours("case2_delay_hours", 1);
      const scheduled = new Date(Date.now() + delay * 3600_000);
      await enqueueIfMissing(lead.id, "case2", scheduled, true);
    }

    return new Response(JSON.stringify({ ok: true, score, tier, demo_tried: demoTried }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("track-visitor error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: corsHeaders });
  }
});
