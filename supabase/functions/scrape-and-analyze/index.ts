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

function getSupabase() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function log(supabase: any, eventType: string, status: string, message: string, metadata: any = {}) {
  try {
    await supabase.from("activity_logs").insert({ event_type: eventType, status, message, metadata });
  } catch { /* non-blocking */ }
}

// Fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Try scraping with Firecrawl — supports rotation through multiple keys
async function scrapeWebsite(supabase: any, websiteUrl: string): Promise<{ content: string; source: string }> {
  // Get all firecrawl keys from api_providers table (category='firecrawl')
  const { data: firecrawlProviders } = await supabase
    .from("api_providers")
    .select("*")
    .eq("category", "firecrawl")
    .eq("is_enabled", true)
    .order("priority", { ascending: true });

  // Build list of keys: env key first, then DB keys
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
        body: JSON.stringify({ url: websiteUrl, formats: ["markdown"], onlyMainContent: true }),
      }, 25000);

      if (res.status === 402) {
        await log(supabase, "firecrawl", "warn", `Firecrawl key "${source}" credits exhausted, trying next`, { source });
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
      await log(supabase, "firecrawl", "success", `Scraped with key "${source}" — ${content.length} chars`, { source });
      return { content, source };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("abort")) {
        await log(supabase, "firecrawl", "warn", `Firecrawl key "${source}" timed out`, { source });
        lastError = `Firecrawl ${source}: timeout`;
      } else {
        await log(supabase, "firecrawl", "warn", `Firecrawl key "${source}" error: ${msg}`, { source });
        lastError = msg;
      }
    }
  }

  throw new Error(`All Firecrawl keys failed. Last error: ${lastError}`);
}

// Try AI analysis with failover across multiple providers
async function analyzeWithAI(supabase: any, businessName: string, websiteUrl: string, websiteContent: string): Promise<any> {
  // Build provider list: Lovable AI first, then DB-configured LLM providers by priority
  const { data: llmProviders } = await supabase
    .from("api_providers")
    .select("*")
    .eq("category", "llm")
    .eq("is_enabled", true)
    .order("priority", { ascending: true });

  interface AIProvider {
    name: string;
    url: string;
    key: string;
    model: string;
  }

  const providers: AIProvider[] = [];

  // Lovable AI as default/first
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) {
    providers.push({
      name: "Lovable AI",
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      key: lovableKey,
      model: "google/gemini-3-flash-preview",
    });
  }

  // DB-configured providers
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

  if (providers.length === 0) {
    throw new Error("No AI providers configured");
  }

  const analysisPrompt = `Analyze this business website content and extract structured information.

Business Name: ${businessName}
Website URL: ${websiteUrl}

Website Content:
${websiteContent.substring(0, 8000)}`;

  const requestBody = (model: string) => ({
    model,
    messages: [
      { role: "system", content: "You are a business analyst. Analyze the website content and extract structured business information. Call the provided tool with accurate data." },
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
      await log(supabase, "ai_analysis", "info", `Trying AI provider: ${provider.name}`, { provider: provider.name, model: provider.model });

      const res = await fetchWithTimeout(provider.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
        body: JSON.stringify(requestBody(provider.model)),
      }, 45000);

      if (res.status === 429) {
        await log(supabase, "ai_analysis", "warn", `${provider.name} rate limited, trying next`, { provider: provider.name });
        lastError = `${provider.name}: rate limited`;
        continue;
      }
      if (res.status === 402) {
        await log(supabase, "ai_analysis", "warn", `${provider.name} credits exhausted, trying next`, { provider: provider.name });
        lastError = `${provider.name}: credits exhausted`;
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

      // Fallback: try parsing content directly
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        await log(supabase, "ai_analysis", "warn", `${provider.name} returned content instead of tool call, using fallback`, { provider: provider.name });
      }
      lastError = `${provider.name}: no tool call in response`;
      continue;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await log(supabase, "ai_analysis", "warn", `${provider.name} error: ${msg}`, { provider: provider.name });
      lastError = `${provider.name}: ${msg.includes("abort") ? "timeout" : msg}`;
    }
  }

  // Final fallback: generate a basic prompt without AI
  console.log("All AI providers failed, using fallback prompt");
  await log(supabase, "ai_analysis", "warn", `All AI providers failed, using generated fallback. Last: ${lastError}`, {});
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getSupabase();

  try {
    const { businessName, websiteUrl } = await req.json();

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

    // Step 1: Scrape
    let websiteContent: string;
    let scrapeSource: string;
    try {
      const result = await scrapeWebsite(supabase, formattedUrl);
      websiteContent = result.content;
      scrapeSource = result.source;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scraping failed";
      await log(supabase, "chatbot_creation", "error", `Scraping failed: ${msg}`, { businessName });
      return new Response(
        JSON.stringify({ error: `Website scraping failed: ${msg}`, step: "scraping" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: AI Analysis (with failover)
    const analysis = await analyzeWithAI(supabase, businessName, formattedUrl, websiteContent);

    // Step 3: Save chatbot
    let slug = slugify(businessName);
    if (!slug) slug = "chatbot";
    const { data: existing } = await supabase.from("chatbots").select("id").eq("slug", slug).maybeSingle();
    if (existing) slug = `${slug}-${randomSuffix()}`;

    const { data: chatbot, error: insertError } = await supabase.from("chatbots").insert({
      business_name: businessName,
      website_url: formattedUrl,
      slug,
      system_prompt: analysis.system_prompt,
      industry: analysis.industry,
      brand_tone: analysis.brand_tone,
      services: analysis.services,
      faq_topics: analysis.faq_topics,
      research_data: {
        website_content_preview: websiteContent.substring(0, 2000),
        analyzed_at: new Date().toISOString(),
        scrape_source: scrapeSource,
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

    const siteDomain = Deno.env.get("SITE_DOMAIN");
    const chatbotUrl = siteDomain ? `https://${siteDomain}/${slug}/chatbot` : `/${slug}/chatbot`;

    await log(supabase, "chatbot_creation", "success", `Chatbot "${businessName}" created at ${chatbotUrl}`, {
      slug,
      aiProvider: analysis._provider,
      wasFallback: !!analysis._fallback,
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
        },
        meta: {
          scrape_source: scrapeSource,
          ai_provider: analysis._provider,
          was_fallback: !!analysis._fallback,
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
