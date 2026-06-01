import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
}

function randomSuffix(): string {
  return Math.random().toString(36).substring(2, 6);
}

// Module-level client reuse
const supabaseClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function log(supabase: any, eventType: string, status: string, message: string, metadata: any = {}) {
  try {
    await supabase.from("activity_logs").insert({ event_type: eventType, status, message, metadata });
  } catch { /* non-blocking */ }
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ── Check cache first ──
async function getCachedScrape(supabase: any, websiteUrl: string): Promise<{ content: string; logoUrl?: string; structured_data?: any } | null> {
  const { data } = await supabase
    .from("scraped_data")
    .select("*")
    .eq("website_url", websiteUrl)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (data) {
    console.log(`Cache hit for ${websiteUrl}`);
    await log(supabase, "scrape_cache", "info", `Cache hit for ${websiteUrl}`, { websiteUrl });
    return {
      content: data.raw_content || "",
      logoUrl: data.logo_url || undefined,
      structured_data: data.structured_data || undefined,
    };
  }
  return null;
}

async function saveScrapeCache(supabase: any, websiteUrl: string, content: string, logoUrl?: string, structuredData?: any) {
  await supabase.from("scraped_data").upsert({
    website_url: websiteUrl,
    raw_content: content,
    logo_url: logoUrl || null,
    structured_data: structuredData || {},
    scraped_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  }, { onConflict: "website_url" });
}

async function scrapeWebsite(supabase: any, websiteUrl: string): Promise<{ content: string; source: string; logoUrl?: string }> {
  const { data: firecrawlProviders } = await supabase
    .from("api_providers")
    .select("*")
    .eq("category", "firecrawl")
    .eq("is_enabled", true)
    .order("priority", { ascending: true });

  const keys: { key: string; source: string }[] = [];
  const envKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (envKey) keys.push({ key: envKey, source: "default" });
  if (firecrawlProviders) {
    for (const p of firecrawlProviders) {
      keys.push({ key: p.api_key, source: p.name });
    }
  }

  if (keys.length === 0) {
    throw new Error("No Firecrawl API keys configured");
  }

  let lastError = "";
  for (const { key, source } of keys) {
    try {
      console.log(`Trying Firecrawl key: ${source}`);
      const res = await fetchWithTimeout("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: websiteUrl, formats: ["markdown", "branding"], onlyMainContent: true }),
      }, 25000);

      if (res.status === 402) {
        await log(supabase, "firecrawl", "warn", `Firecrawl key "${source}" credits exhausted`, { source });
        lastError = `Firecrawl key "${source}" credits exhausted`;
        continue;
      }

      if (!res.ok) {
        const errBody = await res.text();
        await log(supabase, "firecrawl", "warn", `Firecrawl key "${source}" failed: ${res.status}`, { source, status: res.status, body: errBody });
        lastError = `Firecrawl ${source}: ${res.status}`;
        continue;
      }

      const data = await res.json();
      const content = data.data?.markdown || data.markdown || "";
      const logoUrl = data.data?.branding?.logo || data.branding?.logo || data.data?.branding?.images?.logo || undefined;
      await log(supabase, "firecrawl", "success", `Scraped with key "${source}" — ${content.length} chars`, { source, hasLogo: !!logoUrl });
      return { content, source, logoUrl };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await log(supabase, "firecrawl", "warn", `Firecrawl key "${source}" error: ${msg}`, { source });
      lastError = msg.includes("abort") ? `Firecrawl ${source}: timeout` : msg;
    }
  }

  throw new Error(`All Firecrawl keys failed. Last error: ${lastError}`);
}

async function analyzeWithAI(supabase: any, businessName: string, websiteUrl: string, websiteContent: string): Promise<any> {
  const { data: llmProviders } = await supabase
    .from("api_providers")
    .select("*")
    .eq("category", "llm")
    .eq("is_enabled", true)
    .order("priority", { ascending: true });

  interface AIProvider { name: string; url: string; key: string; model: string; }
  const providers: AIProvider[] = [];

  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) {
    providers.push({
      name: "Lovable AI",
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      key: lovableKey,
      model: "google/gemini-3-flash-preview",
    });
  }

  if (llmProviders) {
    for (const p of llmProviders) {
      let url = p.endpoint_url;
      if (!url) {
        switch (p.provider_type) {
          case "openai": url = "https://api.openai.com/v1/chat/completions"; break;
          case "openrouter": url = "https://openrouter.ai/api/v1/chat/completions"; break;
          default: continue;
        }
      }
      providers.push({ name: p.name, url, key: p.api_key, model: p.model || "gpt-4" });
    }
  }

  if (providers.length === 0) throw new Error("No AI providers configured");

  const analysisPrompt = `Analyze this business website and extract structured information for a restaurant/food business.

Business Name: ${businessName}
Website URL: ${websiteUrl}

Website Content:
${websiteContent.substring(0, 10000)}

Extract ALL menu items with prices, categories, hours, address, contact info, and FAQs. Be thorough with menu extraction.`;

  const requestBody = (model: string) => ({
    model,
    messages: [
      { role: "system", content: "You are a business analyst specializing in restaurants and food businesses. Extract comprehensive structured data including full menus with prices, categories, business hours, contact details, and FAQs. Call the provided tool with accurate data." },
      { role: "user", content: analysisPrompt },
    ],
    tools: [{
      type: "function",
      function: {
        name: "analyze_business",
        description: "Return structured business analysis from website content",
        parameters: {
          type: "object",
          properties: {
            industry: { type: "string" },
            brand_tone: { type: "string" },
            services: { type: "array", items: { type: "string" } },
            faq_topics: { type: "array", items: { type: "string" } },
            system_prompt: { type: "string", description: "A complete chatbot system prompt for this business." },
            menu_items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  price: { type: "string" },
                  category: { type: "string" },
                  description: { type: "string" },
                },
              },
              description: "All menu items with prices and categories",
            },
            categories: { type: "array", items: { type: "string" }, description: "Menu categories" },
            business_hours: { type: "string", description: "Opening hours" },
            address: { type: "string", description: "Business address" },
            phone: { type: "string", description: "Phone number" },
            email: { type: "string", description: "Email address" },
          },
          required: ["industry", "brand_tone", "services", "faq_topics", "system_prompt"],
          additionalProperties: false,
        },
      },
    }],
    tool_choice: { type: "function", function: { name: "analyze_business" } },
  });

  let lastError = "";
  for (const provider of providers) {
    try {
      console.log(`Trying AI: ${provider.name} (${provider.model})`);
      await log(supabase, "ai_analysis", "info", `Trying AI provider: ${provider.name}`, { provider: provider.name });

      const res = await fetchWithTimeout(provider.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
        body: JSON.stringify(requestBody(provider.model)),
      }, 45000);

      if (res.status === 429 || res.status === 402) {
        const reason = res.status === 402 ? "credits exhausted" : "rate limited";
        await log(supabase, "ai_analysis", "warn", `${provider.name} ${reason}`, { provider: provider.name });
        lastError = `${provider.name}: ${reason}`;
        continue;
      }
      if (!res.ok) {
        const errText = await res.text();
        await log(supabase, "ai_analysis", "warn", `${provider.name} failed: ${res.status}`, { provider: provider.name, body: errText });
        lastError = `${provider.name}: ${res.status}`;
        continue;
      }

      const data = await res.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        const analysis = JSON.parse(toolCall.function.arguments);
        await log(supabase, "ai_analysis", "success", `Analysis completed with ${provider.name}`, { provider: provider.name });
        return { ...analysis, _provider: provider.name };
      }
      lastError = `${provider.name}: no tool call in response`;
      continue;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await log(supabase, "ai_analysis", "warn", `${provider.name} error: ${msg}`, { provider: provider.name });
      lastError = `${provider.name}: ${msg.includes("abort") ? "timeout" : msg}`;
    }
  }

  console.log("All AI providers failed, using fallback prompt");
  await log(supabase, "ai_analysis", "warn", `All AI providers failed. Last: ${lastError}`, {});
  return {
    industry: "General",
    brand_tone: "Professional and friendly",
    services: [],
    faq_topics: [],
    system_prompt: `You are an AI assistant for ${businessName}. Help customers with their questions about the business. Be professional, friendly, and helpful.`,
    _provider: "fallback",
    _fallback: true,
  };
}

/** Extract only protocol+host from a URL, stripping any path */
function sanitizeOrigin(raw: string): string {
  try {
    return new URL(raw).origin;
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = supabaseClient;

  try {
    const { businessName, websiteUrl, forceRefresh, calendarUrl, origin } = await req.json();

    if (!businessName || !websiteUrl) {
      return new Response(
        JSON.stringify({ error: "businessName and websiteUrl are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let formattedUrl = websiteUrl.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    await log(supabase, "chatbot_creation", "info", `Starting chatbot creation for "${businessName}"`, { businessName, websiteUrl: formattedUrl });

    // Step 1: Check cache first (unless forceRefresh)
    let websiteContent: string;
    let scrapeSource: string;
    let logoUrl: string | undefined;
    let cachedStructuredData: any = undefined;

    if (!forceRefresh) {
      const cached = await getCachedScrape(supabase, formattedUrl);
      if (cached) {
        websiteContent = cached.content;
        scrapeSource = "cache";
        logoUrl = cached.logoUrl;
        cachedStructuredData = cached.structured_data;
      }
    }

    if (!websiteContent!) {
      try {
        const result = await scrapeWebsite(supabase, formattedUrl);
        websiteContent = result.content;
        scrapeSource = result.source;
        logoUrl = result.logoUrl;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Scraping failed";
        await log(supabase, "chatbot_creation", "error", `Scraping failed: ${msg}`, { businessName });
        return new Response(
          JSON.stringify({ error: `Website scraping failed: ${msg}`, step: "scraping" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Step 2: AI Analysis
    const analysis = await analyzeWithAI(supabase, businessName, formattedUrl, websiteContent!);

    // Platform sniff for e-commerce auto-detection
    const lc = (websiteContent || "").toLowerCase();
    let detectedPlatform: string | null = null;
    if (lc.includes("cdn.shopify.com") || lc.includes("shopify.theme") || lc.includes("/products.json")) detectedPlatform = "shopify";
    else if (lc.includes("woocommerce") || lc.includes("wc-block") || lc.includes("wp-content/plugins/woocommerce")) detectedPlatform = "woocommerce";
    else if (lc.includes("gumroad.com")) detectedPlatform = "gumroad";
    else if (lc.includes("lemonsqueezy") || lc.includes("lemon.squeezy")) detectedPlatform = "lemonsqueezy";
    else if (lc.includes("bigcommerce")) detectedPlatform = "bigcommerce";
    else if (lc.includes("checkout.stripe.com") && (lc.includes("buy now") || lc.includes("add to cart"))) detectedPlatform = "stripe";
    if (detectedPlatform) {
      analysis.industry = "ecommerce";
      (analysis as any)._store_platform = detectedPlatform;
    }


    // Build structured data for cache
    const structuredData = {
      menu_items: analysis.menu_items || cachedStructuredData?.menu_items || [],
      categories: analysis.categories || cachedStructuredData?.categories || [],
      business_hours: analysis.business_hours || cachedStructuredData?.business_hours || "",
      address: analysis.address || cachedStructuredData?.address || "",
      phone: analysis.phone || cachedStructuredData?.phone || "",
      email: analysis.email || cachedStructuredData?.email || "",
      services: analysis.services || [],
      faq_topics: analysis.faq_topics || [],
    };

    // Save to cache
    if (scrapeSource! !== "cache") {
      await saveScrapeCache(supabase, formattedUrl, websiteContent!, logoUrl, structuredData);
    }

    // Step 3: Save chatbot
    let slug = slugify(businessName);
    if (!slug) slug = "chatbot";
    const { data: existing } = await supabase.from("chatbots").select("id").eq("slug", slug).maybeSingle();
    if (existing) slug = `${slug}-${randomSuffix()}`;

    const widgetConfig: any = {
      greeting: `Welcome to ${businessName}! How can I help you today?`,
      position: "bottom-right",
      logo: logoUrl || null,
    };
    if (calendarUrl) widgetConfig.calendarUrl = calendarUrl;

    const { data: chatbot, error: insertError } = await supabase.from("chatbots").insert({
      business_name: businessName,
      website_url: formattedUrl,
      slug,
      system_prompt: analysis.system_prompt,
      industry: analysis.industry,
      brand_tone: analysis.brand_tone,
      services: analysis.services,
      faq_topics: analysis.faq_topics,
      logo_url: logoUrl || null,
      widget_config: widgetConfig,
      store_platform: (analysis as any)._store_platform || null,
      store_name: (analysis as any)._store_platform ? businessName : null,
      research_data: {
        ...structuredData,
        website_content_preview: websiteContent!.substring(0, 2000),
        analyzed_at: new Date().toISOString(),
        scrape_source: scrapeSource!,
        ai_provider: analysis._provider,
        was_fallback: !!analysis._fallback,
      },
    }).select().single();

    if (insertError) {
      console.error("Insert error:", insertError);
      await log(supabase, "chatbot_creation", "error", `DB insert failed: ${insertError.message}`, { businessName });
      return new Response(
        JSON.stringify({ error: "Failed to save chatbot", step: "database" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize origin for URL generation
    const siteUrl = origin ? sanitizeOrigin(origin) : (Deno.env.get("SITE_URL") || "");
    const baseUrl = siteUrl.replace(/\/+$/, "");
    const chatbotUrl = baseUrl ? `${baseUrl}/chatbot/${slug}` : `/chatbot/${slug}`;

    await log(supabase, "chatbot_creation", "success", `Chatbot "${businessName}" created at ${chatbotUrl}`, {
      slug, aiProvider: analysis._provider, wasFallback: !!analysis._fallback, hasLogo: !!logoUrl,
    });

    return new Response(
      JSON.stringify({
        success: true,
        chatbot_url: chatbotUrl,
        slug,
        analysis: {
          industry: analysis.industry,
          brand_tone: analysis.brand_tone,
          services: analysis.services,
          faq_topics: analysis.faq_topics,
          system_prompt: analysis.system_prompt,
          menu_items: structuredData.menu_items,
          categories: structuredData.categories,
        },
        meta: {
          scrape_source: scrapeSource!,
          ai_provider: analysis._provider,
          was_fallback: !!analysis._fallback,
          logo_url: logoUrl || null,
          cached: scrapeSource! === "cache",
        },
        chatbot,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("Unexpected error:", err);
    await log(supabase, "chatbot_creation", "error", `Unexpected: ${msg}`, {});
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
