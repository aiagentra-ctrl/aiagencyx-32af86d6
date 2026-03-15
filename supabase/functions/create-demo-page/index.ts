import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function randomSuffix(): string {
  return Math.random().toString(36).substring(2, 6);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const {
      assistantId, businessName, description, vapiKey,
      clientName, companyName, industry,
      heroTitle, heroSubtitle, calendlyUrl, ctaText,
      contactEmail, contactPhone, customSubdomain,
    } = await req.json();

    if (!assistantId || !businessName || !vapiKey) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: assistantId, businessName, vapiKey" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let slug = customSubdomain ? slugify(customSubdomain) : slugify(businessName);
    if (!slug) slug = "demo";

    const { data: existing } = await supabase
      .from("demo_pages")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existing) {
      slug = `${slug}-${randomSuffix()}`;
    }

    const { data, error } = await supabase.from("demo_pages").insert({
      slug,
      assistant_id: assistantId,
      business_name: businessName,
      description: description || null,
      vapi_key: vapiKey,
      client_name: clientName || null,
      company_name: companyName || null,
      industry: industry || null,
      hero_title: heroTitle || null,
      hero_subtitle: heroSubtitle || null,
      calendly_url: calendlyUrl || null,
      cta_text: ctaText || null,
      contact_email: contactEmail || null,
      contact_phone: contactPhone || null,
      custom_subdomain: customSubdomain || null,
    }).select().single();

    if (error) {
      console.error("Insert error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to create demo page" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const siteUrl = Deno.env.get("SITE_URL") || `${supabaseUrl.replace('.supabase.co', '')}.netlify.app`;
    const url = `${siteUrl}/demo/${slug}`;

    return new Response(
      JSON.stringify({ url, slug, assistantId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
