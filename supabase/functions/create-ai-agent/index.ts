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
    const body = await req.json();
    const {
      type, // "voice" | "chatbot" | "both"
      businessName,
      // Voice agent fields
      assistantId, vapiKey,
      clientName, companyName, industry,
      heroTitle, heroSubtitle, calendlyUrl, ctaText,
      contactEmail, contactPhone, customSubdomain,
      description,
      // Chatbot fields
      websiteUrl,
      // Origin for URL generation
      origin,
    } = body;

    if (!businessName) {
      return new Response(
        JSON.stringify({ error: "businessName is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const agentType = type || (assistantId && vapiKey ? "voice" : websiteUrl ? "chatbot" : "voice");

    if ((agentType === "voice" || agentType === "both") && (!assistantId || !vapiKey)) {
      return new Response(
        JSON.stringify({ error: "assistantId and vapiKey are required for voice agents" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if ((agentType === "chatbot" || agentType === "both") && !websiteUrl) {
      return new Response(
        JSON.stringify({ error: "websiteUrl is required for chatbot agents" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Determine base URL: use provided origin, or SITE_URL, or fallback
    const siteUrl = origin || Deno.env.get("SITE_URL") || "";
    const baseUrl = siteUrl.replace(/\/+$/, "");

    const results: any = { businessName };

    // --- Create Voice Agent (Demo Page) ---
    if (agentType === "voice" || agentType === "both") {
      const rawSlug = customSubdomain || clientName || businessName;
      let voiceSlug = slugify(rawSlug);
      if (!voiceSlug) voiceSlug = "demo";

      const { data: existing } = await supabase
        .from("demo_pages")
        .select("id")
        .eq("slug", voiceSlug)
        .maybeSingle();

      if (existing) voiceSlug = `${voiceSlug}-${randomSuffix()}`;

      const { data: voicePage, error: voiceErr } = await supabase.from("demo_pages").insert({
        slug: voiceSlug,
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
        custom_subdomain: voiceSlug,
      }).select().single();

      if (voiceErr) {
        console.error("Voice agent insert error:", voiceErr);
        return new Response(
          JSON.stringify({ error: "Failed to create voice agent page" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      results.voiceAgent = {
        slug: voiceSlug,
        url: baseUrl ? `${baseUrl}/${voiceSlug}` : `/${voiceSlug}`,
        id: voicePage.id,
      };
    }

    // --- Create Chatbot ---
    if (agentType === "chatbot" || agentType === "both") {
      // Call the scrape-and-analyze function internally
      const scrapeRes = await fetch(`${supabaseUrl}/functions/v1/scrape-and-analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ businessName, websiteUrl }),
      });

      const scrapeData = await scrapeRes.json();

      if (!scrapeRes.ok) {
        return new Response(
          JSON.stringify({ error: scrapeData.error || "Chatbot creation failed", step: scrapeData.step || "chatbot" }),
          { status: scrapeRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      results.chatbot = {
        slug: scrapeData.slug,
        url: baseUrl ? `${baseUrl}/chatbot/${scrapeData.slug}` : `/chatbot/${scrapeData.slug}`,
        id: scrapeData.chatbot?.id,
        analysis: scrapeData.analysis,
        meta: scrapeData.meta,
      };
    }

    return new Response(
      JSON.stringify({
        success: true,
        type: agentType,
        ...results,
      }),
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
