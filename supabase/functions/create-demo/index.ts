import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildRealEstateVoicePrompt, isRealEstateIndustry } from "../_shared/realestate-prompt.ts";
import { checkFirecrawl } from "../_shared/firecrawl.ts";
import { startDemoJob, runStep, recordStep, stepDone, finishJob } from "../_shared/jobs.ts";
import { buildLocalBizPrompt, findNichePack, resolveVars } from "../_shared/localbiz-prompt.ts";
import { matchIndustry, extractSignals } from "../_shared/industry-match.ts";
import { realAgentTools } from "../_shared/agent-tools.ts";
import {
  isRestaurantIndustry, detectRestaurantCapabilities, buildRestaurantPrompt,
  restaurantAgentTools, capabilityLabel, menuSection,
} from "../_shared/restaurant-prompt.ts";
import { uploadVapiTextFile, canonicalKnowledgeBase } from "../_shared/vapi-files.ts";



const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Module-level client reuse
const supabaseClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

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
  // Parallel scraping — all pages at once instead of sequential
  const promises = urls.map(async (url) => {
    try {
      const res = await fetchWithTimeout("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
      }, 15000);
      if (res.ok) {
        const data = await res.json();
        const md = data.data?.markdown || data.markdown || "";
        if (md) return `\n--- PAGE: ${url} ---\n${md}`;
      } else { await res.text(); }
    } catch { /* skip */ }
    return "";
  });
  const results = await Promise.allSettled(promises);
  return results
    .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled" && !!r.value)
    .map(r => r.value)
    .join("\n");
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

  // Env OpenRouter key as last resort
  const envOr = Deno.env.get("OPENROUTER_API_KEY");
  if (envOr && !keys.length) {
    keys.push({
      key: envOr,
      url: "https://openrouter.ai/api/v1/chat/completions",
      model: "anthropic/claude-sonnet-5:online",
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
  const envOr = Deno.env.get("OPENROUTER_API_KEY");
  if (envOr) providers.push({ name: "OpenRouter", url: "https://openrouter.ai/api/v1/chat/completions", key: envOr, model: "anthropic/claude-sonnet-5" });
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

// ── Restaurant-specific VAPI prompt (production-grade, follows VAPI Prompting Guide) ──
function buildRestaurantVoicePrompt(
  agentName: string,
  businessName: string,
  knowledgeBase: string,
  structuredData: any
): string {
  const menu = structuredData?.menu_items || [];
  const services = structuredData?.services || [];
  const hours = structuredData?.business_hours || "";
  const phone = structuredData?.phone || "";
  const address = structuredData?.address || "";

  let menuSection = "";
  if (menu.length > 0) {
    const byCategory: Record<string, any[]> = {};
    for (const item of menu) {
      const cat = item.category || "Other";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(item);
    }
    menuSection = Object.entries(byCategory).map(([cat, items]) =>
      `### ${cat}\n${(items as any[]).map((i: any) => `- ${i.name}${i.price ? ` — ${i.price}` : ""}${i.description ? `: ${i.description}` : ""}`).join("\n")}`
    ).join("\n\n");
  }

  return `[Identity]
You are ${agentName}, a real team member at ${businessName}.
You've worked here for a while. You know the menu by heart.
You're the person everyone loves talking to when they call — friendly, quick, and helpful.
You are NOT an AI. You are NOT a virtual assistant. You're just ${agentName} from ${businessName}.

[Style]
- Conversational, warm, like talking to a friend on the phone
- Use contractions always: I'm, we've, that's, don't, gonna, wanna, y'all
- Natural fillers: "Sure thing", "Gotcha", "Oh yeah", "Absolutely", "For sure"
- Spell out prices naturally: say "twelve ninety-nine" not "twelve dollars and ninety-nine cents" or "$12.99"
- Keep every response to one to three sentences max
- No corporate language ever. Never say "I'd be happy to assist" or "Thank you for your inquiry"
- Add natural pauses: "Let me think..." "Hmm..." "Oh wait..."
- Sound like you're smiling when you talk

[Response Guidelines]
- Ask ONE question at a time — never stack questions
- Remember everything the caller said: their name, preferences, allergies, party size, budget
- Use their name naturally if they give it: "Got it, Sarah!"
- Confirm before finalizing any order or reservation
- Never say "function", "tool", "API", "system", "AI", or "assistant"
- If they ask "are you real?" just laugh: "Ha, last time I checked! What can I get for you?"
- Never read out lists — describe items conversationally

[Task: Taking Orders]
Step 1: "What are you in the mood for today?"
<wait for user response>

Step 2: Based on their answer, suggest two to three items from the menu.
- Say the name and price naturally: "We've got the chicken parmesan, that's about fourteen ninety-nine, it's really popular"
- If they mention a preference like spicy, vegetarian, or budget, filter your suggestions
- If they're unsure: "Well, our [popular item] is what most people go for — it's really good"
<wait for user response>

Step 3: When they pick something: "Great choice! Want to add [popular side or drink] with that? We've got a combo deal going on"
<wait for user response>

Step 4: "Any allergies or changes I should note? Like no onions, extra sauce, anything like that?"
<wait for user response>

Step 5: Confirm the full order: "Alright so I've got [items with modifications]. That's gonna be about [total]. Sound right?"
<wait for user response>

Step 6: "Cool — pickup or delivery?"
- If pickup: "Should be ready in about [time]. What name for the order?"
- If delivery: "What's the delivery address?" then "Should be there in about [time]"
<wait for user response>

Step 7: "You're all set! Anything else before I let you go?"

[Task: Table Reservations]
Step 1: "Sure, I can set that up! What date were you thinking?"
<wait for user response>

Step 2: "And what time works best for you?"
<wait for user response>

Step 3: "How many people?"
<wait for user response>

Step 4: "Can I get a name for the reservation?"
<wait for user response>

Step 5: "And a phone number just in case we need to reach you?"
<wait for user response>

Step 6: "Got it — ${agentName === agentName ? "[name]" : ""}, party of [size], [date] at [time]. You're all set! We'll see you then."

[Task: Menu Questions]
- When they ask about a category: describe two to three best items conversationally with prices
- When they ask "what's good?" or "what do you recommend?": suggest your most popular items enthusiastically
- When they ask about dietary options: filter and suggest matching items
- When they ask about specials: mention today's specials, combos, or deals if any
- Always describe food with appetite appeal: "It's got this amazing crispy crust..." not just "It contains cheese"

[Task: Natural Upselling]
- After they pick a main item: casually suggest a side or drink: "Oh by the way, want a drink with that? The mango lemonade goes really well with it"
- Mention combos if they exist: "We actually have a combo that saves you like three bucks..."
- If ordering for a group: "Want me to throw in a few different things so everyone's happy?"
- NEVER be pushy — just mention it once. If they say no, move on immediately

${hours ? `[Business Hours]\n${hours}` : ""}
${address ? `[Location]\n${address}` : ""}
${phone ? `[Phone]\n${phone}` : ""}

${menuSection ? `[Full Menu]\n${menuSection}` : ""}

${services.length > 0 ? `[Services]\n${services.map((s: string) => `- ${s}`).join("\n")}` : ""}

[Error Handling]
- Didn't catch what they said: "Sorry, I missed that — could you say it one more time?"
- Item not on menu: "Hmm, I don't think we have that one... but we do have [similar item]. Wanna try that instead?"
- Can't answer a question: "That's a good question — let me have someone get back to you on that. What's a good number to reach you?"
- Off-topic or weird question: "Ha, that's a good one! Anyway, what can I get for you?"
- They're frustrated: "I totally get it, sorry about that. Let me make sure we get this right for you."

[Knowledge Base]
${knowledgeBase}`;
}

// ── Generic voice agent prompt (non-restaurant industries) ──
function buildGenericVoicePrompt(
  agentName: string,
  businessName: string,
  industry: string,
  systemPrompt: string,
  knowledgeBase: string,
  structuredData: any
): string {
  const industryLabel = industry === "general" ? "business" : industry.replace(/_/g, " ");

  const menu = structuredData?.menu_items || [];
  const products = structuredData?.products || [];
  const services = structuredData?.services || [];
  const allItems = [
    ...menu.map((i: any) => ({ ...i, type: "menu" })),
    ...products.map((i: any) => ({ ...i, type: "product" })),
  ];

  let topItemsSummary = "";
  if (allItems.length > 0) {
    topItemsSummary = allItems.slice(0, 15).map((i: any) =>
      `- ${i.name}${i.price ? ` (${i.price})` : ""}${i.description ? ` — ${i.description}` : ""} [${i.category || i.type}]`
    ).join("\n");
  }

  let industryFlows = "";
  const li = industry.toLowerCase();

  if (li.includes("ecommerce") || li.includes("shop") || li.includes("store") || li.includes("retail")) {
    industryFlows = `\n## VOICE SHOPPING ASSISTANT — ${businessName}
You are a voice shopping assistant. Rules for voice:
- Maximum 2 sentences per response. Always.
- Say prices naturally: 'forty-nine ninety-nine' not '$49.99'
- Say 'We have' not 'The store has' (you ARE the store)
- When recommending products, say the name and price then ask if they want to hear more:
  'We have the [Name] for [price] — great for [use case]. Want to hear more about it or see another option?'
- When you find products: call the search_products tool first, THEN respond
- Offer to send a link at every opportunity: 'Want me to send you a link to that?'
- For sizes/availability: check the tool result for variant data

NEVER: list more than 2 products verbally at once (they can't see a screen).
NEVER: read out long descriptions — summarize in 5 words max.
NEVER: say 'I found X products matching...' — just describe the best one naturally.`;
  } else if (li.includes("clinic") || li.includes("dental") || li.includes("medical") || li.includes("doctor") || li.includes("health")) {
    industryFlows = `\n## APPOINTMENT BOOKING\n1. Ask what service they need\n2. Suggest relevant services\n3. Ask preferred date/time\n4. Collect name + phone\n5. Confirm appointment`;
  } else if (li.includes("salon") || li.includes("spa") || li.includes("beauty") || li.includes("barber")) {
    industryFlows = `\n## BOOKING FLOW\n1. Ask what service (haircut, color, facial)\n2. Suggest services + pricing\n3. Book date/time\n4. Confirm`;
  } else if (li.includes("real_estate") || li.includes("property") || li.includes("realty")) {
    industryFlows = `\n## PROPERTY INQUIRY\n1. Buy/rent/commercial?\n2. Location + budget\n3. Suggest listings\n4. Schedule viewing`;
  } else if (li.includes("law") || li.includes("legal") || li.includes("attorney")) {
    industryFlows = `\n## CONSULTATION FLOW\n1. Legal matter type\n2. Explain practice areas\n3. Offer consultation\n4. Schedule + collect details`;
  } else if (li.includes("gym") || li.includes("fitness")) {
    industryFlows = `\n## MEMBERSHIP FLOW\n1. Ask fitness goals\n2. Suggest plans\n3. Offer trial/tour\n4. Sign-up guidance`;
  } else {
    industryFlows = `\n## GENERAL INQUIRY FLOW\n1. Understand the caller's needs\n2. Suggest relevant services from KB\n3. Answer pricing/hours questions\n4. Offer to book/schedule\n5. Collect contact for follow-up`;
  }

  return `## ROLE & IDENTITY
You are ${agentName}, a real staff member at ${businessName} (a ${industryLabel} business).
You sound like a real person on the phone — warm, natural, and helpful. NOT a robot, NOT an AI assistant.
Use the caller's name if they give it. Remember details they mention throughout the call.

## VOICE & TONE RULES
- Use contractions (I'm, we've, that's, don't)
- Keep responses 1-3 sentences max
- Sound genuinely interested, not scripted
- Use filler words naturally ("Sure thing", "Gotcha", "Absolutely")
- No corporate phrases ("I'd be happy to assist", "Thank you for your inquiry")
- No bullet points or lists — speak naturally

## SMART RECOMMENDATIONS
When the caller asks about ${products.length > 0 ? "products" : "services"}:
- Search your knowledge base for the best 2-3 matches
- Present each: name, price, and one-line description
- Ask: "Want me to add that?" or "Sound good?"
- If nothing matches: "Hmm, let me think... we do have [alternative]. Would that work?"

${topItemsSummary ? `## TOP ITEMS\n${topItemsSummary}\n` : ""}
${services.length > 0 ? `## SERVICES\n${services.map((s: string) => `- ${s}`).join("\n")}\n` : ""}
${industryFlows}

## MULTI-TURN CONTEXT
- Remember everything the caller said
- Don't ask the same thing twice
- Ask ONE question at a time

## FALLBACK
- Don't know? "Let me check on that... I can have someone get back to you."
- Never make up info
- If confused: "Sorry, could you say that again?"

${systemPrompt}

## Knowledge Base
${knowledgeBase}`;
}

// ── Dental-specific VAPI prompt (production-grade) ──
function buildDentalVoicePrompt(
  agentName: string,
  businessName: string,
  knowledgeBase: string,
  structuredData: any
): string {
  const services = structuredData?.services || structuredData?.products || [];
  const hours = structuredData?.business_hours || "";
  const phone = structuredData?.phone || "";
  const address = structuredData?.address || "";

  let servicesSection = "";
  if (services.length > 0) {
    servicesSection = services.map((s: any) => {
      if (typeof s === "string") return `- ${s}`;
      return `- ${s.name}${s.price ? ` — ${s.price}` : ""}${s.description ? `: ${s.description}` : ""}`;
    }).join("\n");
  }

  return `[Identity]
You are ${agentName}, the front desk receptionist at ${businessName}.
You've been here for years. You know every treatment, every dentist, every policy.
Patients love you because you're warm, calm, and genuinely helpful — especially with nervous callers.
You are NOT an AI. You are NOT a virtual assistant. You're just ${agentName} from ${businessName}.
You speak like a real person answering the phone at a dental office.

[Style]
- Warm, reassuring, and professional — patients may be anxious or in pain
- Use contractions always: I'm, we've, that's, don't, we'll, you'll
- Natural fillers: "Sure thing", "Absolutely", "Of course", "No problem at all"
- Spell out prices naturally: say "two hundred fifty" not "$250"
- Keep every response to one to three sentences max
- No corporate or clinical jargon with patients — keep it simple
- Reassuring phrases: "We'll take great care of you", "Don't worry, we see this all the time"
- Sound calm and confident — never rushed

[Response Guidelines]
- Ask ONE question at a time — never stack questions
- Remember everything: name, concern, insurance, preferred times
- Use their name naturally: "Got it, Sarah!"
- Confirm before finalizing any appointment
- Never say "function", "tool", "API", "system", "AI", or "assistant"
- If asked "are you real?": "Ha, last time I checked! How can I help you today?"
- Never guess treatments, pricing, or insurance coverage — only state what's in your knowledge base

[Task: Appointment Booking]
Step 1: "What brings you in? Is it a routine cleaning, a specific concern, or something else?"
<wait for user response>

Step 2: Based on their answer, suggest relevant services from KB with pricing if available.
- "We can definitely help with that! We offer [service] — that's usually around [price]"
- If unsure what they need: "No worries — we can start with a quick exam and go from there"
<wait for user response>

Step 3: "Do you have a preferred day? We have openings this week and next"
<wait for user response>

Step 4: "Morning or afternoon work better for you?"
<wait for user response>

Step 5: "Can I get your name?"
<wait for user response>

Step 6: "And the best phone number to reach you?"
<wait for user response>

Step 7: "Do you have dental insurance? If so, which provider?"
- If they have insurance: "Great, we'll verify your coverage before your visit"
- If no insurance: "No problem! We have flexible payment options. We can go over that when you come in"
<wait for user response>

Step 8: Confirm everything: "So I've got you down for [service] on [date], [time]. Name is [name], and I have your number as [phone]. Sound good?"
<wait for user response>

Step 9: "You're all set! We'll send you a confirmation. If you need to reschedule, just give us a call. See you then!"

[Task: Emergency Handling]
URGENT KEYWORDS: pain, emergency, broken, cracked, knocked out, bleeding, swelling, abscess, infection, throbbing, can't eat, can't sleep

When detected:
- Immediately prioritize: "Oh no, I'm sorry to hear that. Let's get you in as soon as possible."
- Ask: "Can you tell me a bit more about what's going on? How long has it been hurting?"
<wait for user response>
- "We'll get you in right away. Let me find the earliest opening — can I get your name and number?"
<wait for user response>
- Fast-track to booking — skip non-essential questions
- Reassure: "We see this all the time — you'll be in good hands"

[Task: Service Questions]
- Pull from knowledge base ONLY — never guess treatments or pricing
- Describe treatments simply: "A root canal basically saves a damaged tooth so you don't have to extract it"
- If pricing is in KB: share it naturally. If not: "Pricing depends on a few things — I can have our billing team give you an exact quote"
- Always guide toward booking: "Want me to set up a consultation so the doctor can take a look?"
<wait for user response>

[Task: Insurance & Pricing]
- If insurance info is in KB: "Yes, we accept [provider]!"
- If not in KB: "I'm not one hundred percent sure about that one — let me have our billing team check and get back to you. What's the best number?"
- For pricing questions: share KB prices if available, otherwise: "It depends on the specific treatment plan, but I can give you a ballpark — or we can do a free consultation"
- Never guess copays or coverage
<wait for user response>

[Task: Patient Recall & Follow-ups]
- If caller mentions it's been a while: "No judgment at all! It's actually really common. Let's get you back on track with a cleaning and check-up"
- Proactively suggest: "When was your last cleaning? We usually recommend every six months"
- For follow-ups: "The doctor wanted you to come back in [timeframe] — want me to get that scheduled?"
<wait for user response>

[KB Usage Rules — STRICT]
- ONLY answer from verified knowledge base data
- NEVER guess services, treatments, or pricing
- NEVER mention "scraped data", "database", "knowledge base", or "Firecrawl"
- Present all information naturally as if you know it from working there
- If data is available → answer directly and confidently
- If data is partially available → answer what you know + clarify: "I'd want to double-check on that"
- If data is missing → "That's a great question — let me have someone confirm that and get back to you. What's a good number?"
- Always guide toward booking after answering questions

${hours ? `[Business Hours]\n${hours}` : ""}
${address ? `[Location]\n${address}` : ""}
${phone ? `[Phone]\n${phone}` : ""}
${servicesSection ? `[Services & Treatments]\n${servicesSection}` : ""}

[Error Handling]
- Didn't catch what they said: "Sorry, I missed that — could you say it one more time?"
- Service not offered: "Hmm, I don't think we offer that specifically, but we do have [alternative]. Want me to set that up?"
- Can't answer: "Good question — let me have our team get back to you on that. What's a good number to reach you?"
- Off-topic: "Ha, fair enough! So, was there anything dental I can help with?"
- Nervous caller: "I totally understand — a lot of our patients feel the same way. Our team is really gentle, I promise"
- Frustrated caller: "I'm really sorry about that. Let me make sure we get this sorted for you right away"

[Knowledge Base]
${knowledgeBase}`;
}

// ── Voice prompt dispatcher ──
// Restaurant detection lives in _shared/restaurant-prompt.ts (isRestaurantIndustry).


function isDentalIndustry(industry: string): boolean {
  const li = industry.toLowerCase();
  return ["dental", "dentist", "clinic", "orthodont", "oral", "healthcare", "medical", "doctor", "health"]
    .some(k => li.includes(k));
}

function getVoicePrompt(
  agentName: string,
  businessName: string,
  industry: string,
  systemPrompt: string,
  knowledgeBase: string,
  structuredData: any
): string {
  if (isRestaurantIndustry(industry)) {
    return buildRestaurantVoicePrompt(agentName, businessName, knowledgeBase, structuredData);
  }
  if (isDentalIndustry(industry)) {
    return buildDentalVoicePrompt(agentName, businessName, knowledgeBase, structuredData);
  }
  return buildGenericVoicePrompt(agentName, businessName, industry, systemPrompt, knowledgeBase, structuredData);
}

// ── Create VAPI Assistant ──
async function createVapiAssistant(adminSettings: Record<string, string>, systemPrompt: string, firstMessage: string, knowledgeBase: string, businessName: string, industry: string, structuredData: any, chatbotId?: string, nicheMatch?: any): Promise<string> {
  const vapiKey = adminSettings.vapi_private_key || Deno.env.get("VAPI_API_KEY");
  if (!vapiKey) throw new Error("VAPI private key not configured. Set it in Admin → Settings.");

  const agentName = adminSettings.default_agent_name || "Alex";
  let basePrompt = getVoicePrompt(agentName, businessName, industry, systemPrompt, knowledgeBase, structuredData);
  let usedLocalBiz = false;

  // ── Local-business master template (pre-filled niche packs) ──
  const nichePack = findNichePack(nicheMatch?.niche);
  if (nichePack) {
    try {
      const appCfg: Record<string, string> = {};
      const { data: cfgRows } = await supabaseClient.from("app_config").select("key, value");
      for (const r of cfgRows || []) appCfg[r.key] = r.value ?? "";

      basePrompt = buildLocalBizPrompt({
        vars: resolveVars({
          companyName: businessName,
          agentName,
          pack: nichePack,
          overrides: {
            ...(nicheMatch?.industry_category ? { industry_category: nicheMatch.industry_category } : {}),
            ...(nicheMatch?.project_type_list ? { project_type_list: nicheMatch.project_type_list } : {}),
            ...(nicheMatch?.pricing_policy_line ? { pricing_policy_line: nicheMatch.pricing_policy_line } : {}),
          },
          settings: { ...appCfg, ...adminSettings },
        }),
        channel: "voice",
        knowledgeBase,
        coreFacts: null,
        adaptationNotes: nicheMatch?.decision === "use_as_is" ? null : (nicheMatch?.adaptation_notes || null),
        chatbotId: chatbotId || null,
      });
      usedLocalBiz = true;
    } catch (e) {
      console.warn("[create-demo] localbiz prompt skipped:", e instanceof Error ? e.message : e);
    }
  }

  // ── Restaurant template: capability-aware (reservations / orders / both / neither) ──
  let usedRestaurant = false;
  let restaurantCaps: any = null;
  let templateFirstMessage = "";
  if (!usedLocalBiz && (isRestaurantIndustry(industry) || nicheMatch?.niche === "restaurant")) {
    try {
      const { data: tpl } = await supabaseClient
        .from("industry_templates")
        .select("system_prompt_template, first_message_template, voice_config, chatbot_config, status")
        .eq("industry_name", "restaurant")
        .maybeSingle();

      if (!tpl || tpl.status === "active") {
        const capOverrides = { ...(tpl?.chatbot_config?.capabilities || {}) };
        for (const k of Object.keys(capOverrides)) {
          if (capOverrides[k] === null || capOverrides[k] === undefined) delete capOverrides[k];
        }

        restaurantCaps = detectRestaurantCapabilities({
          content: [knowledgeBase, JSON.stringify(structuredData || {})].join("\n"),
          structured: structuredData || {},
          overrides: capOverrides,
        });

        basePrompt = buildRestaurantPrompt({
          agentName,
          businessName,
          caps: restaurantCaps,
          knowledgeBase,
          structured: structuredData || {},
          chatbotId: chatbotId || null,
          channel: "voice",
          templateOverride:
            tpl?.voice_config?.voice_prompt_template?.trim() || tpl?.system_prompt_template?.trim() || null,
          adaptationNotes: nicheMatch?.decision === "use_as_is" ? null : (nicheMatch?.adaptation_notes || null),
        });
        templateFirstMessage = injectVars(tpl?.first_message_template || "", { business_name: businessName, agent_name: agentName });
        usedRestaurant = true;
        console.log(`[create-demo] restaurant ${businessName}: ${capabilityLabel(restaurantCaps)}`);
      }
    } catch (e) {
      console.warn("[create-demo] restaurant prompt skipped:", e instanceof Error ? e.message : e);
    }
  }




  // Real estate v3 master prompt — only when a classified profile exists and is confident.
  if (!usedLocalBiz && chatbotId && isRealEstateIndustry(industry)) {
    try {
      const { data: reProfile } = await supabaseClient
        .from("realestate_profiles").select("*").eq("chatbot_id", chatbotId).maybeSingle();
      if (reProfile && reProfile.confidence && reProfile.confidence !== "low") {
        basePrompt = buildRealEstateVoicePrompt({
          agentName, businessName, profile: reProfile as any, knowledgeBase, chatbotId,
        });
        await supabaseClient.from("realestate_profiles")
          .update({ generated_prompt: basePrompt }).eq("chatbot_id", chatbotId);
      }
    } catch (e) {
      console.warn("[create-demo] real estate prompt skipped:", e instanceof Error ? e.message : e);
    }
  }

  const ragRules = (chatbotId && !usedLocalBiz && !usedRestaurant) ? `


## RAG TOOL — STRICT RULES
You have a tool called \`search_knowledge_base(query)\`.
- BEFORE answering ANY factual question (services, pricing, hours, properties, menu, policies),
  CALL search_knowledge_base FIRST with the user's question.
- Speak ONLY from the tool's returned text. Never invent facts.
- If the tool returns "Let me check with our team on that." or empty results,
  say exactly: "Let me check with our team on that."
` : "";
  const fullPrompt = basePrompt + ragRules;

  const voiceProvider = adminSettings.voice_provider || "azure";
  const voiceId = adminSettings.voice_id || "andrew";
  const modelProvider = adminSettings.ai_model_provider || "openai";
  const model = adminSettings.ai_model || "gpt-4o";
  const endCallMessage = injectVars(adminSettings.default_end_call_message || "Thanks for calling {business_name}! Have a great one. 👋", { business_name: businessName });

  const kbTool = chatbotId ? {
    type: "function",
    async: false,
    function: {
      name: "search_knowledge_base",
      description: "FALLBACK lookup. Use only when the attached knowledge base does not contain the answer, is unclear, or errors. Searches the business knowledge base for facts, pricing, properties, services, hours, or any specific information.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "User's question or search query" },
          top_k: { type: "number", description: "Number of results", default: 5 },
          chatbotId: { type: "string", description: "Knowledge base scope id", default: chatbotId },
        },
        required: ["query"],
      },
    },
    server: { url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/search-knowledge-base` },
  } : null;

  // Native Vapi knowledge file was already built + uploaded above (kbAttached).

  const res = await fetchWithTimeout("https://api.vapi.ai/assistant", {
    method: "POST",
    headers: { Authorization: `Bearer ${vapiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: businessName.substring(0, 40),
      firstMessage: templateFirstMessage || firstMessage,
      model: {
        provider: modelProvider,
        model,
        messages: [{ role: "system", content: fullPrompt }],
        maxTokens: 150,
        temperature: 0.7,
        ...(vapiKnowledgeBase ? { knowledgeBase: vapiKnowledgeBase } : {}),
        tools: [...(kbTool ? [kbTool] : []), ...(usedRestaurant ? restaurantAgentTools(restaurantCaps) : realAgentTools())],

      },
      voice: { provider: voiceProvider, voiceId, speed: 1.1 },
      metadata: { ...(chatbotId ? { chatbot_id: chatbotId } : {}), business_name: businessName },

      endCallMessage,
      maxDurationSeconds: 600,
      firstMessageMode: "assistant-speaks-first",
      silenceTimeoutSeconds: 30,
      responseDelaySeconds: 0.4,
      numWordsToInterruptAssistant: 1,
      backgroundDenoisingEnabled: true,
      backchannelingEnabled: true,
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

  const supabase = supabaseClient;
  let jobId: string | null = null;

  try {
    const reqBody = await req.json();
    const { business_name, website_url, calendar_link, industry: userIndustry } = reqBody;
    // Optional follow-up fields (additive — do not affect existing flow)
    const followUp = {
      first_name: reqBody.firstName || null,
      company: reqBody.company || null,
      campaign_name: reqBody.campaignName || null,
      industry: reqBody.industry || null,
      campaign_id: reqBody.campaignId || null,
      lead_source: reqBody.leadSource || null,
      sender_email: reqBody.senderEmail || null,
      message_thread_id: reqBody.messageThreadId || null,
      cc_emails: Array.isArray(reqBody.ccEmails) ? reqBody.ccEmails : [],
      bcc_emails: Array.isArray(reqBody.bccEmails) ? reqBody.bccEmails : [],
    };
    const hasFollowUpData = !!(followUp.first_name || followUp.sender_email || followUp.campaign_id || followUp.message_thread_id);

    if (!business_name || !website_url) {
      return new Response(JSON.stringify({ error: "business_name and website_url are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let formattedUrl = website_url.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) formattedUrl = `https://${formattedUrl}`;

    await log(supabase, "info", `Starting demo creation for "${business_name}"`, { business_name, website_url: formattedUrl, industry: userIndustry });

    // Job tracking — every step is persisted so failures are resumable.
    jobId = await startDemoJob({
      job_id: reqBody.job_id || null,
      email: reqBody.senderEmail || reqBody.email || null,
      prospect_id: reqBody.prospect_id || null,
      business_name,
      website_url: formattedUrl,
    });

    const adminSettings = await loadAdminSettings(supabase);
    const calendarUrl = calendar_link || adminSettings.calendar_url || "";
    // Canonical domain: app_config.site_url wins, then admin settings, then env.
    const { data: siteUrlRow } = await supabase
      .from("app_config").select("value").eq("key", "site_url").maybeSingle();
    const siteUrl = (siteUrlRow?.value || adminSettings.site_url || Deno.env.get("SITE_URL") || "").replace(/\/+$/, "");


    // Step 0: Firecrawl is a HARD dependency — never build a demo without it.
    const cachedFirst = await getCachedContent(supabase, formattedUrl);
    if (!cachedFirst) {
      const health = await runStep(jobId, "firecrawl_check", async () => {
        const h = await checkFirecrawl();
        if (!h.ok) throw new Error(h.error || "Firecrawl unavailable");
        return h;
      }, { serialize: (h) => h }).catch((e) => e as Error);

      if (health instanceof Error) {
        await log(supabase, "error", `Firecrawl unavailable — demo blocked: ${health.message}`, { business_name });
        await finishJob(jobId, "failed", { last_error: `Firecrawl unavailable: ${health.message}` });
        return new Response(JSON.stringify({
          error: `Demo generation blocked: Firecrawl is not working (${health.message}). Fix the Firecrawl connection and retry this job.`,
          job_id: jobId,
          blocked_by: "firecrawl",
        }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else {
      await recordStep(jobId, "firecrawl_check", "skipped", { output: { reason: "cached content" } });
    }

    // Step 1: Scrape (cache-first, now with multi-page)
    let websiteContent = "";
    let logoUrl: string | undefined;
    let structuredData: any = null;

    const cached = cachedFirst;
    if (cached) {
      websiteContent = cached.content;
      logoUrl = cached.logoUrl;
      structuredData = cached.structured_data;
      await recordStep(jobId, "firecrawl_scrape", "completed", { output: { source: "cache", chars: websiteContent.length } });
    }

    if (!websiteContent) {
      try {
        const result = await runStep(jobId, "firecrawl_scrape", () => scrapeWebsite(supabase, formattedUrl, business_name), {
          serialize: (r: any) => ({ chars: (r?.content || "").length, logo: !!r?.logoUrl }),
        });
        websiteContent = result.content;
        logoUrl = result.logoUrl;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Scraping failed";
        await log(supabase, "error", `Scrape failed — demo blocked: ${msg}`, { business_name });
        await finishJob(jobId, "failed", { last_error: `Scrape failed: ${msg}` });
        return new Response(JSON.stringify({
          error: `Demo generation blocked: website scrape failed (${msg}). Retry this job once the source is reachable.`,
          job_id: jobId,
          blocked_by: "scrape",
        }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Step 2: Enhanced LLM extraction (sends up to 15K chars from multi-page content)
    const extractionIndustry = userIndustry && userIndustry !== "default" ? userIndustry : "";
    if (!structuredData?.services?.length && !structuredData?.menu_items?.length) {
      const llmData = await runStep(jobId, "analyze", () => extractStructuredData(supabase, business_name, websiteContent, extractionIndustry), {
        serialize: (d: any) => ({ got: !!d, industry: d?.industry ?? null }),
      });
      if (llmData) structuredData = llmData;
    } else {
      await recordStep(jobId, "analyze", "completed", { output: { source: "cache" } });
    }


    await saveScrapeCache(supabase, formattedUrl, websiteContent, logoUrl, structuredData);

    // Resolve industry: user input → LLM-detected → "general"
    const resolvedIndustry = userIndustry && userIndustry !== "default"
      ? userIndustry
      : structuredData?.industry || "general";
    const mainService = structuredData?.main_service || structuredData?.services?.[0] || resolvedIndustry;

    console.log(`[industry] Resolved: ${resolvedIndustry}, main service: ${mainService}`);

    // ── Niche match: pick the closest pre-filled local-business template ──
    let nicheMatch: any = null;
    try {
      const prior = await stepDone(jobId, "industry_match");
      if (prior?.niche) {
        nicheMatch = prior;
      } else {
        nicheMatch = await runStep(jobId, "industry_match", () => matchIndustry({
          businessName: business_name,
          websiteUrl: formattedUrl,
          signalsText: extractSignals({
            markdown: websiteContent,
            services: structuredData?.services || null,
            titles: structuredData?.main_service ? [structuredData.main_service] : null,
          }),
        }), { serialize: (m: any) => m });
      }
      if (nicheMatch) {
        console.log(`[industry] Niche match: ${nicheMatch.niche} (${nicheMatch.confidence}, ${nicheMatch.decision})`);
      }
    } catch (e) {
      console.warn("[industry] niche match failed:", e instanceof Error ? e.message : e);
    }


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

    const agentName = adminSettings.default_agent_name || "Alex";
    const templateVars: Record<string, string> = {
      business_name,
      calendar_url: calendarUrl,
      industry: resolvedIndustry,
      main_service: mainService,
      agent_name: agentName,
    };

    // Step 3: Build system prompt
    let systemPrompt: string;
    if (template?.system_prompt_template) {
      systemPrompt = injectVars(template.system_prompt_template, templateVars);
    } else if (adminSettings.default_system_prompt) {
      systemPrompt = injectVars(adminSettings.default_system_prompt, templateVars);
    } else {
      systemPrompt = `You are ${agentName}, a friendly staff member at ${business_name}. You talk like a real person — warm, casual, and helpful. Keep responses short and natural. Never sound robotic.`;
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

    const firstMessage = injectVars(
      "Hi! Thanks for calling {business_name}. How can I help?",
      templateVars
    );

    // Pre-generate chatbot id so the voice assistant can carry it as metadata for KB queries
    const preChatbotId = crypto.randomUUID();

    // Real estate pipeline: scrape listings + agency record, then classify, before the
    // voice assistant is built so the v3 master prompt can be filled in.
    if (isRealEstateIndustry(resolvedIndustry)) {
      try {
        const fnBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
        const authHeaders = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        };
        const scrapeRes = await fetch(`${fnBase}/scrape-realestate-listings`, {
          method: "POST", headers: authHeaders,
          body: JSON.stringify({ chatbot_id: preChatbotId, website_url: formattedUrl, business_name }),
        });
        const scrapeJson = await scrapeRes.json().catch(() => ({}));
        await log(supabase, "info", `Real estate scrape done for "${business_name}"`, scrapeJson);

        const classifyRes = await fetch(`${fnBase}/classify-realestate-business`, {
          method: "POST", headers: authHeaders,
          body: JSON.stringify({ chatbot_id: preChatbotId }),
        });
        const classifyJson = await classifyRes.json().catch(() => ({}));
        await log(supabase, "info", `Real estate classification for "${business_name}"`, classifyJson);
      } catch (err) {
        console.error("Real estate pipeline failed:", err);
        await log(supabase, "warning", `Real estate pipeline failed for "${business_name}"`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Step 5: Create VAPI voice assistant
    let assistantId: string;
    const priorVoice = await stepDone(jobId, "create_voice_agent");
    if (priorVoice?.assistant_id) {
      assistantId = priorVoice.assistant_id;
    } else {
      try {
        assistantId = await runStep(jobId, "create_voice_agent",
          () => createVapiAssistant(adminSettings, systemPrompt, firstMessage, knowledgeBase, business_name, resolvedIndustry, structuredData, preChatbotId, nicheMatch),
          { serialize: (id: string) => ({ assistant_id: id }) });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "VAPI creation failed";
        await log(supabase, "error", `VAPI failed: ${msg}`, { business_name });
        await finishJob(jobId, "failed", { last_error: `Voice agent creation failed: ${msg}` });
        return new Response(JSON.stringify({ error: `Voice agent creation failed: ${msg}`, job_id: jobId, blocked_by: "vapi" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
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
      contact_email: structuredData?.email || reqBody.email || reqBody.replyToEmail || null,
      cta_text: ctaText,
      custom_subdomain: demoSlug,
      dynamic_content: dynamicContent,
    }).select().single();

    if (demoErr || !demoPage) {
      console.error("Demo page insert error:", demoErr);
      await recordStep(jobId, "create_demo_page", "failed", { error: demoErr?.message || "insert failed" });
      await finishJob(jobId, "failed", { last_error: `Demo page insert failed: ${demoErr?.message || "unknown"}` });
      return new Response(JSON.stringify({ error: "Failed to create demo page", job_id: jobId, blocked_by: "demo_page" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    await recordStep(jobId, "create_demo_page", "completed", { output: { demo_page_id: demoPage.id, slug: demoSlug } });


    // Step 7: Create chatbot
    let chatbotSlug = slugify(business_name + "-chat");
    if (!chatbotSlug) chatbotSlug = "chatbot";
    const { data: existingChat } = await supabase.from("chatbots").select("id").eq("slug", chatbotSlug).maybeSingle();
    if (existingChat) chatbotSlug = `${chatbotSlug}-${randomSuffix()}`;

    const chatbotGreeting = injectVars(
      adminSettings.chatbot_greeting || "Hey! 👋 Welcome to {business_name}. What can I help you with?",
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
      id: preChatbotId,
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
      matched_industry: nicheMatch?.niche || null,
      match_confidence: nicheMatch?.confidence || null,
      template_overrides: nicheMatch ? {
        decision: nicheMatch.decision,
        adaptation_notes: nicheMatch.decision === "use_as_is" ? "" : (nicheMatch.adaptation_notes || ""),
        ...(nicheMatch.industry_category ? { industry_category: nicheMatch.industry_category } : {}),
        ...(nicheMatch.project_type_list ? { project_type_list: nicheMatch.project_type_list } : {}),
        ...(nicheMatch.pricing_policy_line ? { pricing_policy_line: nicheMatch.pricing_policy_line } : {}),
      } : {},

      research_data: {
        ...structuredData,
        website_content_preview: websiteContent.substring(0, 2000),
        analyzed_at: new Date().toISOString(),
      },
    });

    if (chatErr) {
      console.error("Chatbot insert error:", chatErr);
      await recordStep(jobId, "create_chatbot", "failed", { error: chatErr.message });
    } else {
      await recordStep(jobId, "create_chatbot", "completed", { output: { chatbot_id: preChatbotId, slug: chatbotSlug } });
    }

    const demoUrl = siteUrl ? `${siteUrl}/${demoSlug}` : `/${demoSlug}`;

    // Step 8: (Additive) store follow-up lead data if provided
    let leadId: string | null = null;
    let isComplete = false;
    if (hasFollowUpData) {
      isComplete = !!(followUp.first_name && followUp.sender_email && followUp.campaign_id && followUp.campaign_name && followUp.message_thread_id);
      const { data: leadRow, error: leadErr } = await supabase.from("demo_leads").insert({
        demo_page_id: demoPage.id,
        slug: demoSlug,
        ...followUp,
        is_complete: isComplete,
        status: isComplete ? "pending" : "incomplete",
      }).select("id").maybeSingle();
      if (leadErr) {
        console.error("demo_leads insert error:", leadErr);
        await recordStep(jobId, "store_lead", "failed", { error: leadErr.message });
      } else {
        leadId = leadRow?.id || null;
        await recordStep(jobId, "store_lead", "completed", { output: { lead_id: leadId, is_complete: isComplete } });
      }
    } else {
      await recordStep(jobId, "store_lead", "skipped", { output: { reason: "no follow-up data supplied" } });
    }

    await log(supabase, "success", `Demo created for "${business_name}": ${demoUrl}`, {
      assistantId, demoSlug, chatbotSlug, hasLogo: !!logoUrl, industry: resolvedIndustry,
      templateUsed: template?.industry_name || "none",
      templateAutoGenerated: !!(template && (template as any).display_name?.includes("Auto-generated")),
      leadId,
    });

    await finishJob(jobId, chatErr ? "partial" : "completed", {
      last_error: chatErr ? `Chatbot insert failed: ${chatErr.message}` : null,
      result: { demo_url: demoUrl, demo_page_id: demoPage.id, chatbot_id: preChatbotId, assistant_id: assistantId, lead_id: leadId },
    });

    const respBody: any = { demo_url: demoUrl, job_id: jobId };
    if (leadId) {
      respBody.lead_id = leadId;
      respBody.followUpReady = isComplete;
    }
    return new Response(JSON.stringify(respBody),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });


  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("Unexpected error:", err);
    await log(supabase, "error", `Unexpected: ${msg}`, {});
    await finishJob(jobId, "failed", { last_error: msg });
    return new Response(JSON.stringify({ error: msg, job_id: jobId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

});
