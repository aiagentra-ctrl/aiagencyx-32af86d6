import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { slug, session_id, event_type, metadata = {} } = body;
    if (!slug || !event_type) {
      return new Response(JSON.stringify({ error: "slug and event_type required" }), { status: 400, headers: corsHeaders });
    }

    const ua = req.headers.get("user-agent") || "";
    if (!ua || BOT.test(ua)) return new Response(JSON.stringify({ ok: true, filtered: "bot" }), { headers: corsHeaders });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "unknown";

    // Country gate
    let countryCode: string | null = null;
    if (ip && ip !== "unknown" && ip !== "127.0.0.1") {
      try {
        const r = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode,status`, { signal: AbortSignal.timeout(2500) });
        if (r.ok) { const j = await r.json(); if (j?.status === "success") countryCode = (j.countryCode || "").toUpperCase(); }
      } catch { /* ignore */ }
    }

    const rules = await loadCountryRules();
    if (countryCode && rules.block.includes(countryCode)) {
      return new Response(JSON.stringify({ ok: true, filtered: "country_blocked" }), { headers: corsHeaders });
    }
    if (countryCode && rules.allow.length > 0 && !rules.allow.includes(countryCode)) {
      return new Response(JSON.stringify({ ok: true, filtered: "country_not_allowed" }), { headers: corsHeaders });
    }

    // Find lead row (only proceed if one exists for this slug — created at demo creation)
    const { data: lead } = await supabase.from("demo_leads").select("*").eq("slug", slug).maybeSingle();
    if (!lead) {
      // No follow-up lead attached; nothing to update
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
    if (event_type === "voice_call_started" || event_type === "voice_interaction") {
      demoTried = true; demoTypeTried = "voice"; eng.demo_tried = true;
    }
    if (event_type === "chatbot_message_sent" || event_type === "chatbot_interaction") {
      demoTried = true; demoTypeTried = demoTypeTried || "chatbot"; eng.demo_tried = true;
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
    };
    if (lead.status === "pending" || lead.status === "visited_no_demo") {
      updates.status = demoTried ? "visited_demo_tried" : "visited_no_demo";
    }

    await supabase.from("demo_leads").update(updates).eq("id", lead.id);

    // Trigger follow-up on session_end (or explicit signal), only once
    if ((event_type === "session_end" || event_type === "trigger_follow_up") && !lead.follow_up_sent_at) {
      try {
        const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/trigger-follow-up`;
        await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({ lead_id: lead.id }),
        }).catch(() => {});
      } catch { /* fire-and-forget */ }
    }

    return new Response(JSON.stringify({ ok: true, score, tier, demo_tried: demoTried }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("track-visitor error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: corsHeaders });
  }
});
