import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

async function log(supabase: any, status: string, message: string, metadata: any = {}) {
  try { await supabase.from("activity_logs").insert({ event_type: "create_demo", status, message, metadata }); } catch { /* */ }
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); } finally { clearTimeout(timer); }
}

async function loadAdminSettings(supabase: any): Promise<Record<string, string>> {
  const { data } = await supabase.from("site_settings").select("key, value");
  const map: Record<string, string> = {};
  if (data) for (const row of data) { map[row.key] = row.value || ""; }
  return map;
}

// ── Template Engine ──
async function loadTemplate(supabase: any, industryName: string): Promise<any | null> {
  const { data } = await supabase.from("industry_templates").select("*")
    .eq("industry_name", industryName).eq("status", "active").maybeSingle();
  return data || null;
}

async function loadDefaultTemplate(supabase: any): Promise<any | null> {
  return loadTemplate(supabase, "default");
}

// ── Cache ──
async function getCachedContent(supabase: any, websiteUrl: string) {
  const { data } = await supabase.from("scraped_data").select("*")
    .eq("website_url", websiteUrl).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (data) {
    console.log(`[cache] Hit for ${websiteUrl}`);
    return { content: data.raw_content || "", logoUrl: data.logo_url || undefined, structured_data: data.structured_data };
  }
  return null;
}

async function saveScrapeCache(supabase: any, websiteUrl: string, content: string, logoUrl?: string, structuredData?: any) {
  await supabase.from("scraped_data").upsert({
    website_url: websiteUrl, raw_content: content, logo_url: logoUrl || null,
    structured_data: structuredData || {},
    scraped_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  }, { onConflict: "website_url" });
}

// ── Firecrawl: Multi-page discovery + scrape ──
async function discoverPages(apiKey: string, websiteUrl: string): Promise<string[]> {
  try {
    console.log("[map] Discovering pages...");
    const res = await fetchWithTimeout("https://api.firecrawl.dev/v1/map", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: websiteUrl, limit: 50, includeSubdomains: false }),
    }, 15000);
    if (!res.ok) { await res.text(); return []; }
    const data = await res.json();
    const links: string[] = data.links || data.data?.links || [];
    console.log(`[map] Found ${links.length} pages`);
    return links;
  } catch (err) {
    console.log("[map] Discovery failed, falling back to single page");
    return [];
  }
}

function pickKeyPages(allUrls: string[], baseUrl: string): string[] {
  const patterns = [
    /\/(about|who-we-are|our-story)/i,
    /\/(service|menu|product|pricing|price|plan|offer)/i,
    /\/(faq|help|support|question)/i,
    /\/(contact|location|find-us)/i,
    /\/(team|staff|doctor|lawyer|agent)/i,
  ];
  const picked: string[] = [];
  for (const pattern of patterns) {
    const match = allUrls.find(u => pattern.test(u) && !picked.includes(u));
    if (match) picked.push(match);
  }
  return picked.slice(0, 5);
}

async function scrapeMultiplePages(apiKey: string, urls: string[]): Promise<string> {
  const results: string[] = [];
  for (const url of urls) {
    try {
      const res = await fetchWithTimeout("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
      }, 15000);
      if (res.ok) {
        const data = await res.json();
        const md = data.data?.markdown || data.markdown || "";
        if (md) results.push(`\n--- PAGE: ${url} ---\n${md}`);
      } else { await res.text(); }
    } catch { /* skip */ }
  }
  return results.join("\n");
}

// ── LLM Web Search Fallback (OpenRouter :online) ──
async function scrapeViaLlmWebSearch(supabase: any, websiteUrl: string, businessName: string): Promise<{ content: string; logoUrl?: string }> {
  console.log("[fallback] Using LLM web search to gather business data...");

  // Try OpenRouter providers from api_providers table
  const { data: orProviders } = await supabase.from("api_providers").select("*")
    .eq("provider_type", "openrouter").eq("is_enabled", true).order("priority", { ascending: true });

  const keys: { key: string; url: string; model: string }[] = [];
  if (orProviders) {
    for (const p of orProviders) {
      keys.push({
        key: p.api_key,
        url: p.endpoint_url || "https://openrouter.ai/api/v1/chat/completions",
        model: (p.model || "openai/gpt-5-mini") + ":online",
      });
    }
  }

  // Also try Lovable AI as last resort (no :online but still useful)
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) {
    keys.push({
      key: lovableKey,
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      model: "google/gemini-3-flash-preview",
    });
  }

  if (keys.length === 0) throw new Error("No LLM providers available for fallback");

  for (const provider of keys) {
    try {
      console.log(`[fallback] Trying ${provider.model}`);
      const isOpenRouter = provider.url.includes("openrouter.ai");

      const body: any = {
        model: provider.model,
        messages: [
          { role: "system", content: "You are a business research assistant. Extract comprehensive business information from the web. Return detailed markdown with: business description, services/products with prices, business hours, address, phone, email, key selling points, and any other relevant details." },
          { role: "user", content: `Research this business thoroughly and extract all available information:\n\nBusiness: ${businessName}\nWebsite: ${websiteUrl}\n\nProvide detailed markdown with all services, products, pricing, contact info, hours, and key details.` },
        ],
      };

      // Add web search plugin for OpenRouter
      if (isOpenRouter) {
        body.plugins = [{ id: "web", max_results: 5, include_domains: [new URL(websiteUrl).hostname] }];
      }

      const res = await fetchWithTimeout(provider.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }, 45000);

      if (!res.ok) { await res.text(); continue; }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content && content.length > 100) {
        console.log(`[fallback] Got ${content.length} chars via LLM web search`);
        return { content, logoUrl: undefined };
      }
    } catch (err) {
      console.warn(`[fallback] Provider failed:`, err instanceof Error ? err.message : err);
    }
  }

  throw new Error("LLM web search fallback also failed");
}

async function scrapeWebsite(supabase: any, websiteUrl: string, businessName: string = ""): Promise<{ content: string; logoUrl?: string }> {
  const { data: firecrawlProviders } = await supabase.from("api_providers").select("*")
    .eq("category", "firecrawl").eq("is_enabled", true).order("priority", { ascending: true });

  const keys: { key: string; source: string }[] = [];
  const envKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (envKey) keys.push({ key: envKey, source: "env" });
  if (firecrawlProviders) for (const p of firecrawlProviders) keys.push({ key: p.api_key, source: p.name });

  // If no Firecrawl keys at all, go straight to LLM fallback
  if (keys.length === 0) {
    console.log("[scrape] No Firecrawl keys — using LLM web search fallback");
    return scrapeViaLlmWebSearch(supabase, websiteUrl, businessName);
  }

  let lastError = "";
  for (const { key, source } of keys) {
    try {
      console.log(`[scrape] Trying ${source}`);

      // Step A: Scrape main page with branding
      const res = await fetchWithTimeout("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: websiteUrl, formats: ["markdown", "branding"], onlyMainContent: true }),
      }, 25000);

      if (res.status === 402) { lastError = `${source}: credits exhausted`; await res.text(); continue; }
      if (!res.ok) { lastError = `${source}: ${res.status}`; await res.text(); continue; }

      const data = await res.json();
      let content = data.data?.markdown || data.markdown || "";
      const logoUrl = data.data?.branding?.logo || data.branding?.logo || data.data?.branding?.images?.logo || undefined;

      // Step B: Multi-page discovery + scrape for richer data
      try {
        const allPages = await discoverPages(key, websiteUrl);
        if (allPages.length > 0) {
          const keyPages = pickKeyPages(allPages, websiteUrl);
          if (keyPages.length > 0) {
            console.log(`[scrape] Scraping ${keyPages.length} additional pages`);
            const extraContent = await scrapeMultiplePages(key, keyPages);
            if (extraContent) content += extraContent;
          }
        }
      } catch (err) {
        console.log("[scrape] Multi-page scraping failed, using main page only");
      }

      return { content, logoUrl };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = msg.includes("abort") ? `${source}: timeout` : msg;
    }
  }

  // ── FALLBACK: All Firecrawl keys failed → use LLM web search ──
  console.warn(`[scrape] All Firecrawl keys failed (${lastError}). Trying LLM web search fallback...`);
  try {
    return await scrapeViaLlmWebSearch(supabase, websiteUrl, businessName);
  } catch (fallbackErr) {
    throw new Error(`Firecrawl failed (${lastError}) and LLM fallback also failed`);
  }
}

// ── LLM helpers ──
function buildProviderList(llmProviders: any[]): { name: string; url: string; key: string; model: string }[] {
  const providers: { name: string; url: string; key: string; model: string }[] = [];
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) providers.push({ name: "Lovable AI", url: "https://ai.gateway.lovable.dev/v1/chat/completions", key: lovableKey, model: "google/gemini-3-flash-preview" });
  if (llmProviders) for (const p of llmProviders) {
    let url = p.endpoint_url;
    if (!url) { if (p.provider_type === "openai") url = "https://api.openai.com/v1/chat/completions"; else if (p.provider_type === "openrouter") url = "https://openrouter.ai/api/v1/chat/completions"; else continue; }
    providers.push({ name: p.name, url, key: p.api_key, model: p.model || "gpt-4" });
  }
  return providers;
}

async function callLlmWithTools(providers: any[], body: any): Promise<any> {
  for (const provider of providers) {
    try {
      console.log(`[llm] Trying ${provider.name}`);
      const res = await fetchWithTimeout(provider.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, model: provider.model }),
      }, 60000);
      if (res.status === 429 || res.status === 402) { await res.text(); continue; }
      if (!res.ok) { await res.text(); continue; }
      const data = await res.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) return JSON.parse(toolCall.function.arguments);
    } catch { /* continue */ }
  }
  return null;
}

// ── LLM extraction (enhanced with deeper fields) ──
async function extractStructuredData(supabase: any, businessName: string, websiteContent: string, industry: string): Promise<any> {
  const { data: llmProviders } = await supabase.from("api_providers").select("*")
    .eq("category", "llm").eq("is_enabled", true).order("priority", { ascending: true });
  const providers = buildProviderList(llmProviders || []);
  if (providers.length === 0) return null;

  const industryHint = industry && industry !== "default" ? ` This is a ${industry} business.` : "";

  return callLlmWithTools(providers, {
    messages: [
      { role: "system", content: `Extract structured business data from the website content.${industryHint} Be thorough — extract ALL services, products, pricing, and unique selling points. Call the tool with accurate data found on the website.` },
      { role: "user", content: `Extract structured data from this website.\n\nBusiness: ${businessName}\n\nContent:\n${websiteContent.substring(0, 15000)}` },
    ],
    tools: [{
      type: "function",
      function: {
        name: "extract_business_data",
        description: "Return structured business data extracted from the website",
        parameters: {
          type: "object",
          properties: {
            menu_items: { type: "array", description: "Menu items for restaurants/food businesses", items: { type: "object", properties: { name: { type: "string" }, price: { type: "string" }, category: { type: "string" }, description: { type: "string" } } } },
            products: { type: "array", description: "Products/services with pricing for non-food businesses", items: { type: "object", properties: { name: { type: "string" }, price: { type: "string" }, category: { type: "string" }, description: { type: "string" } } } },
            categories: { type: "array", items: { type: "string" } },
            business_hours: { type: "string" },
            address: { type: "string" },
            phone: { type: "string" },
            email: { type: "string" },
            services: { type: "array", items: { type: "string" } },
            faq_topics: { type: "array", items: { type: "string" } },
            industry: { type: "string", description: "Detected industry: restaurant, clinic, real_estate, salon, gym, ecommerce, agency, law_firm, etc." },
            brand_tone: { type: "string" },
            main_service: { type: "string", description: "The primary service or product this business offers" },
            key_selling_points: { type: "array", description: "3-5 unique selling points that differentiate this business", items: { type: "string" } },
            customer_flow: { type: "string", description: "How customers typically interact with this business (e.g. 'call to book appointment, arrive, get service, pay')" },
            use_cases: { type: "array", description: "3 real scenarios showing how an AI agent would help this business", items: { type: "object", properties: { scenario: { type: "string" }, ai_action: { type: "string" }, outcome: { type: "string" } }, required: ["scenario", "ai_action", "outcome"] } },
            brand_personality: { type: "string", description: "Brand personality in 2-3 words (e.g. 'warm and professional', 'modern and bold')" },
            target_audience: { type: "string", description: "Primary target audience" },
          },
          additionalProperties: false,
        },
      },
    }],
    tool_choice: { type: "function", function: { name: "extract_business_data" } },
  });
}

// ── Generate dynamic content via LLM (expanded with outcomes, trust, voice prompts) ──
async function generateDynamicContent(supabase: any, businessName: string, industry: string, mainService: string, websiteContent: string, structuredData: any): Promise<any> {
  const { data: llmProviders } = await supabase.from("api_providers").select("*")
    .eq("category", "llm").eq("is_enabled", true).order("priority", { ascending: true });
  const providers = buildProviderList(llmProviders || []);
  if (providers.length === 0) return null;

  const sellingPoints = structuredData?.key_selling_points?.join(", ") || "";
  const services = structuredData?.services?.join(", ") || "";

  return callLlmWithTools(providers, {
    messages: [
      { role: "system", content: `You are an expert AI copywriter and conversion specialist. Generate high-converting, industry-specific content for a ${industry} business called "${businessName}". Main service: ${mainService}. ${sellingPoints ? `Key selling points: ${sellingPoints}.` : ""} ${services ? `Services: ${services}.` : ""}` },
      { role: "user", content: `Generate dynamic landing page content for "${businessName}" (${industry}).\n\nWebsite context:\n${websiteContent.substring(0, 4000)}\n\nGenerate ALL fields: hero_subtitle, 4 problem_statements with stats, 5 chatbot_nav_items, first_message greeting, 2 floating_bubbles, 4 voice_prompts (things to try saying), 4 outcome_metrics (before/after results), and 3 trust_lines.` },
    ],
    tools: [{
      type: "function",
      function: {
        name: "generate_dynamic_content",
        description: "Return dynamic landing page content tailored to the business industry",
        parameters: {
          type: "object",
          properties: {
            hero_subtitle: { type: "string" },
            problem_statements: { type: "array", items: { type: "object", properties: { title: { type: "string" }, desc: { type: "string" }, stat: { type: "string" }, statLabel: { type: "string" } }, required: ["title", "desc", "stat", "statLabel"] } },
            chatbot_nav_items: { type: "array", items: { type: "object", properties: { label: { type: "string" }, value: { type: "string" } }, required: ["label", "value"] } },
            first_message: { type: "string" },
            floating_bubbles: { type: "array", items: { type: "string" } },
            voice_prompts: { type: "array", description: "4 things users can try saying to the voice agent, each with emoji and text", items: { type: "object", properties: { emoji: { type: "string" }, text: { type: "string" } }, required: ["emoji", "text"] } },
            outcome_metrics: { type: "array", description: "4 outcome metrics showing what happens with AI", items: { type: "object", properties: { title: { type: "string" }, desc: { type: "string" }, metric: { type: "string" }, metricLabel: { type: "string" }, icon: { type: "string", description: "Icon name: ShoppingCart, CalendarCheck, PhoneCall, UserCheck, Clock, TrendingUp, DollarSign, Star" } }, required: ["title", "desc", "metric", "metricLabel"] } },
            trust_lines: { type: "array", description: "3 personalization trust statements", items: { type: "string" } },
          },
          required: ["hero_subtitle", "problem_statements", "chatbot_nav_items", "first_message", "floating_bubbles", "voice_prompts", "outcome_metrics", "trust_lines"],
          additionalProperties: false,
        },
      },
    }],
    tool_choice: { type: "function", function: { name: "generate_dynamic_content" } },
  });
}

// ── Generate and save a new industry template ──
async function generateAndSaveTemplate(supabase: any, industry: string, businessName: string, mainService: string, websiteContent: string, providers: any[]): Promise<any | null> {
  console.log(`[template] Generating new template for industry: ${industry}`);

  const result = await callLlmWithTools(providers, {
    messages: [
      { role: "system", content: `You are an expert AI system architect. Generate a production-level, reusable industry template for "${industry}" businesses. This template will be used for ALL future ${industry} businesses, so make it generic enough to work broadly but specific enough to be highly effective. Use {business_name}, {main_service}, {industry} as placeholders.` },
      { role: "user", content: `Create a complete industry template for "${industry}" businesses. Context from a real ${industry} business "${businessName}":\n${websiteContent.substring(0, 3000)}\n\nGenerate: system_prompt_template, hero_subtitle_template, first_message_template, 4 problem_statements, 5 chatbot_nav_items, 2 floating_bubbles.` },
    ],
    tools: [{
      type: "function",
      function: {
        name: "create_industry_template",
        description: "Create a reusable industry template with all configuration",
        parameters: {
          type: "object",
          properties: {
            system_prompt_template: { type: "string", description: "Full system prompt using {business_name}, {main_service}, {industry} placeholders. Include: role definition, personality, conversation flow, sales behavior, error handling, do's and don'ts." },
            hero_subtitle_template: { type: "string" },
            first_message_template: { type: "string" },
            problem_statements: { type: "array", items: { type: "object", properties: { title: { type: "string" }, desc: { type: "string" }, stat: { type: "string" }, statLabel: { type: "string" } }, required: ["title", "desc", "stat", "statLabel"] } },
            chatbot_nav_items: { type: "array", items: { type: "object", properties: { label: { type: "string" }, value: { type: "string" } }, required: ["label", "value"] } },
            floating_bubbles: { type: "array", items: { type: "string" } },
          },
          required: ["system_prompt_template", "hero_subtitle_template", "first_message_template", "problem_statements", "chatbot_nav_items", "floating_bubbles"],
          additionalProperties: false,
        },
      },
    }],
    tool_choice: { type: "function", function: { name: "create_industry_template" } },
  });

  if (!result) return null;

  // Save to database for future reuse
  const displayName = industry.charAt(0).toUpperCase() + industry.slice(1).replace(/_/g, " ");
  const { data: saved, error } = await supabase.from("industry_templates").insert({
    industry_name: industry,
    display_name: `${displayName} (Auto-generated)`,
    system_prompt_template: result.system_prompt_template,
    hero_subtitle_template: result.hero_subtitle_template,
    first_message_template: result.first_message_template,
    problem_statements: result.problem_statements || [],
    chatbot_nav_items: result.chatbot_nav_items || [],
    floating_bubbles: result.floating_bubbles || [],
    status: "active",
    priority: 5,
  }).select().single();

  if (error) {
    console.error("[template] Failed to save template:", error);
    // Still return the generated data even if save fails
    return { ...result, industry_name: industry };
  }

  console.log(`[template] Saved new template for "${industry}" (id: ${saved.id})`);
  return saved;
}

// ── Build knowledge base ──
function buildKnowledgeBase(businessName: string, structuredData: any, websiteContent: string): string {
  const menu = structuredData?.menu_items || [];
  const products = structuredData?.products || [];
  const hours = structuredData?.business_hours || "";
  const address = structuredData?.address || "";
  const phone = structuredData?.phone || "";
  const services = structuredData?.services || [];
  const faqs = structuredData?.faq_topics || [];
  const sellingPoints = structuredData?.key_selling_points || [];

  const itemsSection = menu.length > 0
    ? `\n### Menu\n${menu.map((item: any) => `- ${item.name}: ${item.price}${item.description ? ` — ${item.description}` : ""}`).join("\n")}`
    : products.length > 0
    ? `\n### Products & Pricing\n${products.map((item: any) => `- ${item.name}: ${item.price}${item.description ? ` — ${item.description}` : ""}`).join("\n")}`
    : "";

  return `## Business Information
- Name: ${businessName}
${address ? `- Address: ${address}` : ""}
${phone ? `- Phone: ${phone}` : ""}
${hours ? `- Hours: ${hours}` : ""}
${services.length > 0 ? `- Services: ${services.join(", ")}` : ""}
${sellingPoints.length > 0 ? `\n### Key Selling Points\n${sellingPoints.map((s: string) => `- ${s}`).join("\n")}` : ""}
${itemsSection}
${faqs.length > 0 ? `\n### Common Questions\n${faqs.map((f: string) => `- ${f}`).join("\n")}` : ""}

### Additional Context
${websiteContent.substring(0, 3000)}`;
}

function injectVars(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}

// ── Create VAPI Assistant ──
async function createVapiAssistant(adminSettings: Record<string, string>, systemPrompt: string, firstMessage: string, knowledgeBase: string, businessName: string): Promise<string> {
  const vapiKey = adminSettings.vapi_private_key || Deno.env.get("VAPI_API_KEY");
  if (!vapiKey) throw new Error("VAPI private key not configured. Set it in Admin → Settings.");

  const fullPrompt = `${systemPrompt}\n\n## Knowledge Base\n${knowledgeBase}`;
  const voiceProvider = adminSettings.voice_provider || "azure";
  const voiceId = adminSettings.voice_id || "andrew";
  const modelProvider = adminSettings.ai_model_provider || "openai";
  const model = adminSettings.ai_model || "gpt-4o";
  const endCallMessage = injectVars(adminSettings.default_end_call_message || "Thank you for calling {business_name}. Have a great day!", { business_name: businessName });

  const res = await fetchWithTimeout("https://api.vapi.ai/assistant", {
    method: "POST",
    headers: { Authorization: `Bearer ${vapiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: businessName.substring(0, 40),
      firstMessage,
      model: { provider: modelProvider, model, messages: [{ role: "system", content: fullPrompt }] },
      voice: { provider: voiceProvider, voiceId },
      endCallMessage,
      maxDurationSeconds: 600,
      firstMessageMode: "assistant-speaks-first",
    }),
  }, 30000);

  if (!res.ok) { const err = await res.text(); throw new Error(`VAPI error ${res.status}: ${err}`); }
  const data = await res.json();
  if (!data.id) throw new Error("VAPI response missing assistant id");
  return data.id;
}

// ── Main handler ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = getSupabase();

  try {
    const { business_name, website_url, calendar_link, industry: userIndustry } = await req.json();

    if (!business_name || !website_url) {
      return new Response(JSON.stringify({ error: "business_name and website_url are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let formattedUrl = website_url.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) formattedUrl = `https://${formattedUrl}`;

    await log(supabase, "info", `Starting demo creation for "${business_name}"`, { business_name, website_url: formattedUrl, industry: userIndustry });

    const adminSettings = await loadAdminSettings(supabase);
    const calendarUrl = calendar_link || adminSettings.calendar_url || "";
    const siteUrl = (adminSettings.site_url || Deno.env.get("SITE_URL") || "").replace(/\/+$/, "");

    // Step 1: Scrape (cache-first, now with multi-page)
    let websiteContent = "";
    let logoUrl: string | undefined;
    let structuredData: any = null;

    const cached = await getCachedContent(supabase, formattedUrl);
    if (cached) {
      websiteContent = cached.content;
      logoUrl = cached.logoUrl;
      structuredData = cached.structured_data;
    }

    if (!websiteContent) {
      try {
        const result = await scrapeWebsite(supabase, formattedUrl);
        websiteContent = result.content;
        logoUrl = result.logoUrl;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Scraping failed";
        console.warn(`[scrape] Fallback mode — scraping failed: ${msg}`);
        await log(supabase, "warning", `Scrape failed, using fallback: ${msg}`, { business_name });
        // BACKUP: continue without scraped content — LLM will generate from business name alone
        websiteContent = `Business: ${business_name}\nWebsite: ${formattedUrl}\nNo website content available — generate based on business name and URL.`;
      }
    }

    // Step 2: Enhanced LLM extraction (sends up to 15K chars from multi-page content)
    const extractionIndustry = userIndustry && userIndustry !== "default" ? userIndustry : "";
    if (!structuredData?.services?.length && !structuredData?.menu_items?.length) {
      const llmData = await extractStructuredData(supabase, business_name, websiteContent, extractionIndustry);
      if (llmData) structuredData = llmData;
    }

    await saveScrapeCache(supabase, formattedUrl, websiteContent, logoUrl, structuredData);

    // Resolve industry: user input → LLM-detected → "general"
    const resolvedIndustry = userIndustry && userIndustry !== "default"
      ? userIndustry
      : structuredData?.industry || "general";
    const mainService = structuredData?.main_service || structuredData?.services?.[0] || resolvedIndustry;

    console.log(`[industry] Resolved: ${resolvedIndustry}, main service: ${mainService}`);

    // ── TEMPLATE ENGINE: Smart detection + auto-generation ──
    let template = await loadTemplate(supabase, resolvedIndustry);

    // If no industry-specific template, try to generate and save one
    if (!template && resolvedIndustry !== "default" && resolvedIndustry !== "general") {
      const { data: llmProviders } = await supabase.from("api_providers").select("*")
        .eq("category", "llm").eq("is_enabled", true).order("priority", { ascending: true });
      const providers = buildProviderList(llmProviders || []);
      if (providers.length > 0) {
        try {
          template = await generateAndSaveTemplate(supabase, resolvedIndustry, business_name, mainService, websiteContent, providers);
        } catch (err) {
          console.error("[template] Auto-generation failed:", err);
        }
      }
    }

    // Fallback to default template
    if (!template) template = await loadDefaultTemplate(supabase);

    console.log(`[template] Using: ${template ? template.industry_name : "LLM-generated (no template)"}`);

    const templateVars: Record<string, string> = {
      business_name,
      calendar_url: calendarUrl,
      industry: resolvedIndustry,
      main_service: mainService,
    };

    // Step 3: Build system prompt
    let systemPrompt: string;
    if (template?.system_prompt_template) {
      systemPrompt = injectVars(template.system_prompt_template, templateVars);
    } else if (adminSettings.default_system_prompt) {
      systemPrompt = injectVars(adminSettings.default_system_prompt, templateVars);
    } else {
      systemPrompt = `You are the AI assistant for ${business_name}. Be friendly, professional, and helpful.`;
    }

    const knowledgeBase = buildKnowledgeBase(business_name, structuredData, websiteContent);

    // Step 4: Build dynamic content from template OR LLM (expanded)
    let dynamicContent: any = {};

    if (template) {
      const tProblems = template.problem_statements || [];
      const tNavItems = template.chatbot_nav_items || [];
      const tBubbles = template.floating_bubbles || [];
      const tHeroSub = template.hero_subtitle_template ? injectVars(template.hero_subtitle_template, templateVars) : null;

      dynamicContent = {
        hero_subtitle: tHeroSub,
        problem_statements: tProblems.length > 0 ? tProblems : undefined,
        chatbot_nav_items: tNavItems.length > 0 ? tNavItems : undefined,
        floating_bubbles: tBubbles.length > 0 ? tBubbles : undefined,
        first_message: template.first_message_template ? injectVars(template.first_message_template, templateVars) : undefined,
        source: "template",
        template_industry: template.industry_name,
      };
    }

    // If template didn't provide full content, use LLM to fill gaps
    if (!dynamicContent.problem_statements || !dynamicContent.chatbot_nav_items || !dynamicContent.voice_prompts) {
      try {
        const llmContent = await generateDynamicContent(supabase, business_name, resolvedIndustry, mainService, websiteContent, structuredData);
        if (llmContent) {
          dynamicContent = {
            ...dynamicContent,
            hero_subtitle: dynamicContent.hero_subtitle || llmContent.hero_subtitle,
            problem_statements: dynamicContent.problem_statements || llmContent.problem_statements,
            chatbot_nav_items: dynamicContent.chatbot_nav_items || llmContent.chatbot_nav_items,
            floating_bubbles: dynamicContent.floating_bubbles || llmContent.floating_bubbles,
            first_message: dynamicContent.first_message || llmContent.first_message,
            voice_prompts: llmContent.voice_prompts,
            outcome_metrics: llmContent.outcome_metrics,
            trust_lines: llmContent.trust_lines,
            source: dynamicContent.source || "llm_generated",
          };
        }
      } catch (err) {
        console.error("Dynamic content generation failed:", err);
      }
    }

    // Inject use_cases from extraction
    if (structuredData?.use_cases) {
      dynamicContent.use_case_scenarios = structuredData.use_cases;
    }

    const firstMessage = dynamicContent.first_message || injectVars(
      adminSettings.default_first_message || "Hi, thank you for calling {business_name}! How can I help you?",
      templateVars
    );

    // Step 5: Create VAPI voice assistant
    let assistantId: string;
    try {
      assistantId = await createVapiAssistant(adminSettings, systemPrompt, firstMessage, knowledgeBase, business_name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "VAPI creation failed";
      await log(supabase, "error", `VAPI failed: ${msg}`, { business_name });
      return new Response(JSON.stringify({ error: `Voice agent creation failed: ${msg}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Step 6: Create demo page
    const vapiPublicKey = adminSettings.vapi_public_key || "";
    let demoSlug = slugify(business_name);
    if (!demoSlug) demoSlug = "demo";
    const { data: existingDemo } = await supabase.from("demo_pages").select("id").eq("slug", demoSlug).maybeSingle();
    if (existingDemo) demoSlug = `${demoSlug}-${randomSuffix()}`;

    const ctaText = adminSettings.default_cta_text || "Book a 10-min Setup Call";
    const heroSubtitle = dynamicContent.hero_subtitle || `We built a live AI that answers calls and chats for ${business_name} — try it now.`;

    const { data: demoPage, error: demoErr } = await supabase.from("demo_pages").insert({
      slug: demoSlug,
      assistant_id: assistantId,
      business_name,
      vapi_key: vapiPublicKey,
      company_name: business_name,
      industry: resolvedIndustry,
      calendly_url: calendarUrl || null,
      hero_title: `Your AI Receptionist for ${business_name} is Ready`,
      hero_subtitle: heroSubtitle,
      contact_phone: structuredData?.phone || null,
      contact_email: structuredData?.email || null,
      cta_text: ctaText,
      custom_subdomain: demoSlug,
      dynamic_content: dynamicContent,
    }).select().single();

    if (demoErr) {
      console.error("Demo page insert error:", demoErr);
      return new Response(JSON.stringify({ error: "Failed to create demo page" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Step 7: Create chatbot
    let chatbotSlug = slugify(business_name + "-chat");
    if (!chatbotSlug) chatbotSlug = "chatbot";
    const { data: existingChat } = await supabase.from("chatbots").select("id").eq("slug", chatbotSlug).maybeSingle();
    if (existingChat) chatbotSlug = `${chatbotSlug}-${randomSuffix()}`;

    const chatbotGreeting = injectVars(
      adminSettings.chatbot_greeting || "Welcome to {business_name}! How can I help you today?",
      templateVars
    );

    const widgetConfig: any = {
      greeting: chatbotGreeting,
      position: adminSettings.chatbot_position || "bottom-right",
      logo: logoUrl || null,
      navItems: dynamicContent.chatbot_nav_items || null,
    };
    if (calendarUrl) widgetConfig.calendarUrl = calendarUrl;

    const chatbotSystemPrompt = `${systemPrompt}\n\n## Knowledge Base\n${knowledgeBase}`;

    const { error: chatErr } = await supabase.from("chatbots").insert({
      business_name,
      website_url: formattedUrl,
      slug: chatbotSlug,
      system_prompt: chatbotSystemPrompt,
      industry: resolvedIndustry,
      brand_tone: structuredData?.brand_tone || "Professional and friendly",
      services: structuredData?.services || [],
      faq_topics: structuredData?.faq_topics || [],
      logo_url: logoUrl || null,
      widget_config: widgetConfig,
      demo_page_id: demoPage.id,
      research_data: {
        ...structuredData,
        website_content_preview: websiteContent.substring(0, 2000),
        analyzed_at: new Date().toISOString(),
      },
    });

    if (chatErr) console.error("Chatbot insert error:", chatErr);

    const demoUrl = siteUrl ? `${siteUrl}/${demoSlug}` : `/${demoSlug}`;

    await log(supabase, "success", `Demo created for "${business_name}": ${demoUrl}`, {
      assistantId, demoSlug, chatbotSlug, hasLogo: !!logoUrl, industry: resolvedIndustry,
      templateUsed: template?.industry_name || "none",
      templateAutoGenerated: !!(template && (template as any).display_name?.includes("Auto-generated")),
    });

    return new Response(JSON.stringify({ demo_url: demoUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("Unexpected error:", err);
    await log(supabase, "error", `Unexpected: ${msg}`, {});
    return new Response(JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
