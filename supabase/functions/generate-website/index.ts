import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getSupabase() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
}

function randomSuffix(): string {
  return Math.random().toString(36).substring(2, 6);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = getSupabase();

  try {
    const { business_name, assistant_id, vapi_public_key, calendar_link, industry, logo_url, contact_phone, contact_email, origin } = await req.json();

    if (!business_name || !assistant_id) {
      return new Response(JSON.stringify({ error: "business_name and assistant_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: settings } = await supabase.from("site_settings").select("key, value");
    const adminSettings: Record<string, string> = {};
    if (settings) for (const row of settings) { adminSettings[row.key] = row.value || ""; }

    const vapiKey = vapi_public_key || adminSettings.vapi_public_key || "";
    const ctaText = adminSettings.default_cta_text || "Book a 10-min Setup Call";
    const calendarUrl = calendar_link || adminSettings.calendar_url || "";
    const siteUrl = (origin || adminSettings.site_url || Deno.env.get("SITE_URL") || "").replace(/\/+$/, "");

    let demoSlug = slugify(business_name);
    if (!demoSlug) demoSlug = "demo";
    const { data: existing } = await supabase.from("demo_pages").select("id").eq("slug", demoSlug).maybeSingle();
    if (existing) demoSlug = `${demoSlug}-${randomSuffix()}`;

    const { data: demoPage, error: demoErr } = await supabase.from("demo_pages").insert({
      slug: demoSlug,
      assistant_id,
      business_name,
      vapi_key: vapiKey,
      company_name: business_name,
      industry: industry || "General",
      calendly_url: calendarUrl || null,
      hero_title: `Your AI Receptionist for ${business_name} is Ready`,
      hero_subtitle: `We built a live AI that answers calls and chats for ${business_name} — try it now.`,
      contact_phone: contact_phone || null,
      contact_email: contact_email || null,
      cta_text: ctaText,
      custom_subdomain: demoSlug,
    }).select().single();

    if (demoErr) {
      return new Response(JSON.stringify({ error: "Failed to create demo page" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const demoUrl = siteUrl ? `${siteUrl}/${demoSlug}` : `/${demoSlug}`;

    return new Response(JSON.stringify({
      demo_url: demoUrl,
      demo_page_id: demoPage.id,
      slug: demoSlug,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
