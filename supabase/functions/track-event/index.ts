import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadOwnerConfig, resolveSelfTraffic } from "../_shared/geo.ts";



const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Known bot user-agent patterns
const BOT_PATTERNS = [
  /bot/i, /crawl/i, /spider/i, /slurp/i, /mediapartners/i,
  /headless/i, /phantom/i, /selenium/i, /puppeteer/i, /playwright/i,
  /wget/i, /curl/i, /python-requests/i, /axios/i, /node-fetch/i,
  /go-http-client/i, /java\//i, /libwww/i, /httpclient/i,
  /googlebot/i, /bingbot/i, /yandexbot/i, /baiduspider/i,
  /facebookexternalhit/i, /twitterbot/i, /linkedinbot/i,
  /whatsapp/i, /telegrambot/i, /discordbot/i, /applebot/i,
  /semrushbot/i, /ahrefsbot/i, /mj12bot/i, /dotbot/i,
  /petalbot/i, /bytespider/i, /gptbot/i, /claudebot/i,
];

function isBot(ua: string): boolean {
  if (!ua || ua.length < 10) return true;
  return BOT_PATTERNS.some((p) => p.test(ua));
}

// Parse device info from user-agent
function parseDevice(ua: string): { device_type: string; browser: string; os: string } {
  if (!ua) return { device_type: "unknown", browser: "unknown", os: "unknown" };

  // Device type
  let device_type = "desktop";
  if (/mobile|android|iphone|ipod|phone|blackberry|opera mini|iemobile/i.test(ua)) device_type = "mobile";
  else if (/tablet|ipad|playbook|silk/i.test(ua)) device_type = "tablet";

  // Browser
  let browser = "unknown";
  if (/edg\//i.test(ua)) browser = "Edge";
  else if (/opr\//i.test(ua) || /opera/i.test(ua)) browser = "Opera";
  else if (/chrome/i.test(ua) && !/edg/i.test(ua)) browser = "Chrome";
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";
  else if (/firefox/i.test(ua)) browser = "Firefox";
  else if (/msie|trident/i.test(ua)) browser = "IE";

  // OS
  let os = "unknown";
  if (/windows/i.test(ua)) os = "Windows";
  else if (/mac os|macintosh/i.test(ua)) os = "macOS";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/linux/i.test(ua)) os = "Linux";
  else if (/cros/i.test(ua)) os = "ChromeOS";

  return { device_type, browser, os };
}

// Module-level client reuse
const supabaseClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { slug, link_type, event_type, session_id, metadata, demo_page_id, chatbot_id, business_name } = body;

    if (!slug || !event_type) {
      return new Response(JSON.stringify({ error: "slug and event_type required" }), { status: 400, headers: corsHeaders });
    }

    const userAgent = req.headers.get("user-agent") || "";

    // 1. Bot detection — reject non-human traffic (fast, no I/O)
    if (isBot(userAgent)) {
      return new Response(JSON.stringify({ ok: true, filtered: "bot" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const visitorIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                      req.headers.get("cf-connecting-ip") ||
                      req.headers.get("x-real-ip") || "unknown";
    const referrer = req.headers.get("referer") || "";
    const deviceInfo = parseDevice(userAgent);

    const supabase = supabaseClient;

    // 2. Run geo lookup, blocked IPs check, and duplicate check ALL in parallel
    const needsGeo = visitorIp && visitorIp !== "unknown" && visitorIp !== "127.0.0.1";
    const [geoResult, ipSettingResult, duplicateResult] = await Promise.all([
      // Geo lookup with short timeout
      needsGeo
        ? fetch(`http://ip-api.com/json/${visitorIp}?fields=countryCode,city,status`, { signal: AbortSignal.timeout(3000) })
            .then(r => r.ok ? r.json() : null).catch(() => null)
        : Promise.resolve(null),
      // Blocked IPs
      supabase.from("site_settings").select("value").eq("key", "blocked_ips").maybeSingle(),
      // Duplicate check
      session_id
        ? supabase.from("link_events").select("id").eq("session_id", session_id).eq("event_type", event_type).eq("slug", slug).gte("created_at", new Date(Date.now() - 5000).toISOString()).limit(1)
        : Promise.resolve({ data: null }),
    ]);

    // Parse geo
    let countryCode = null;
    let city = null;
    if (geoResult?.status === "success") {
      countryCode = geoResult.countryCode || null;
      city = geoResult.city || null;
    }

    // Check blocked IPs
    let blockedIps: string[] = [];
    if (ipSettingResult.data?.value) {
      blockedIps = ipSettingResult.data.value.split(",").map((ip: string) => ip.trim());
    }

    // Geo rule: NP / IN / BD / PK are our own traffic. Everything else — including
    // unknown countries — is treated as real client traffic and tracked.
    const isOwnerCountry = isSelfTrafficCountry(countryCode);
    const isBlockedIp = blockedIps.includes(visitorIp);
    const isOwnerTraffic = isOwnerCountry || isBlockedIp;


    // Check duplicate
    if (duplicateResult.data && duplicateResult.data.length > 0) {
      return new Response(JSON.stringify({ ok: true, filtered: "duplicate" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Validate duration metadata if present
    const meta = metadata || {};
    if (meta.duration_seconds !== undefined) {
      const dur = Number(meta.duration_seconds);
      if (isNaN(dur) || dur < 0 || dur > 86400) {
        delete meta.duration_seconds;
        delete meta.active_time_seconds;
      }
    }

    // 6. Insert validated event with device info
    const { error } = await supabase.from("link_events").insert({
      slug,
      link_type: link_type || "demo",
      event_type,
      session_id: session_id || null,
      visitor_ip: visitorIp,
      country_code: countryCode,
      city,
      is_self_traffic: isOwnerTraffic,

      user_agent: userAgent,
      referrer,
      metadata: {
        ...meta,
        is_owner: isOwnerTraffic,
        device_type: deviceInfo.device_type,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        is_validated: true,
      },
      demo_page_id: demo_page_id || null,
      chatbot_id: chatbot_id || null,
      business_name: business_name || slug,
    });

    if (error) {
      console.error("Insert error:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Track event error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: corsHeaders });
  }
});
