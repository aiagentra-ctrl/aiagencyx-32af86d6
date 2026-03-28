import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { slug, link_type, event_type, session_id, metadata, demo_page_id, chatbot_id, business_name } = await req.json();

    if (!slug || !event_type) {
      return new Response(JSON.stringify({ error: "slug and event_type required" }), { status: 400, headers: corsHeaders });
    }

    // Extract visitor info from headers
    const visitorIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                      req.headers.get("cf-connecting-ip") ||
                      req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "";
    const referrer = req.headers.get("referer") || "";

    // Geo lookup via free API
    let countryCode = null;
    let city = null;
    if (visitorIp && visitorIp !== "unknown" && visitorIp !== "127.0.0.1") {
      try {
        const geoRes = await fetch(`http://ip-api.com/json/${visitorIp}?fields=countryCode,city`);
        if (geoRes.ok) {
          const geo = await geoRes.json();
          countryCode = geo.countryCode || null;
          city = geo.city || null;
        }
      } catch {
        // Geo lookup failed, continue without it
      }
    }

    // Tag as owner traffic if from Nepal (owner's location)
    const isOwnerTraffic = countryCode === "NP";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if owner has blocked specific IPs via site_settings
    let blockedIps: string[] = [];
    try {
      const { data: ipSetting } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "blocked_ips")
        .maybeSingle();
      if (ipSetting?.value) {
        blockedIps = ipSetting.value.split(",").map((ip: string) => ip.trim());
      }
    } catch { /* ignore */ }

    const isBlockedIp = blockedIps.includes(visitorIp);

    const { error } = await supabase.from("link_events").insert({
      slug,
      link_type: link_type || "demo",
      event_type,
      session_id: session_id || null,
      visitor_ip: visitorIp,
      country_code: countryCode,
      city,
      user_agent: userAgent,
      referrer,
      metadata: {
        ...(metadata || {}),
        is_owner: isOwnerTraffic || isBlockedIp,
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
