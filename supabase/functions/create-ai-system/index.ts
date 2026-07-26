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

function sanitizeOrigin(raw: string): string {
  try { return new URL(raw).origin; } catch { return raw.replace(/\/+$/, ""); }
}

async function log(supabase: any, eventType: string, status: string, message: string, metadata: any = {}) {
  try { await supabase.from("activity_logs").insert({ event_type: eventType, status, message, metadata }); } catch { /* */ }
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); } finally { clearTimeout(timer); }
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

// ── Firecrawl with branding ──
async function scrapeWebsite(supabase: any, websiteUrl: string): Promise<{ content: string; source: string; logoUrl?: string }> {
  const { data: firecrawlProviders } = await supabase.from("api_providers").select("*")
    .eq("category", "firecrawl").eq("is_enabled", true).order("priority", { ascending: true });

  const keys: { key: string; source: string }[] = [];
  const envKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (envKey) keys.push({ key: envKey, source: "default" });
  if (firecrawlProviders) for (const p of firecrawlProviders) keys.push({ key: p.api_key, source: p.name });
  if (keys.length === 0) throw new Error("No Firecrawl API keys configured");

  let lastError = "";
  for (const { key, source } of keys) {
    try {
      console.log(`[scrape] Trying ${source}`);
      const res = await fetchWithTimeout("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: websiteUrl, formats: ["markdown", "branding"], onlyMainContent: true }),
      }, 25000);

      if (res.status === 402) { lastError = `${source}: credits exhausted`; await res.text(); continue; }
      if (!res.ok) { lastError = `${source}: ${res.status}`; await res.text(); continue; }

      const data = await res.json();
      const content = data.data?.markdown || data.markdown || "";
      const logoUrl = data.data?.branding?.logo || data.branding?.logo || data.data?.branding?.images?.logo || undefined;
      return { content, source, logoUrl };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = msg.includes("abort") ? `${source}: timeout` : msg;
    }
  }
  throw new Error(`All Firecrawl keys failed. Last: ${lastError}`);
}

// ── LLM Analysis ──
async function analyzeWithAI(supabase: any, businessName: string, category: string, websiteContent: string): Promise<any> {
  const { data: llmProviders } = await supabase.from("api_providers").select("*")
    .eq("category", "llm").eq("is_enabled", true).order("priority", { ascending: true });

  interface P { name: string; url: string; key: string; model: string }
  const providers: P[] = [];
  const envOr = Deno.env.get("OPENROUTER_API_KEY");
  if (envOr) providers.push({ name: "OpenRouter", url: "https://openrouter.ai/api/v1/chat/completions", key: envOr, model: "anthropic/claude-sonnet-5" });
  if (llmProviders) for (const p of llmProviders) {
    let url = p.endpoint_url;
    if (!url) { if (p.provider_type === "openai") url = "https://api.openai.com/v1/chat/completions"; else if (p.provider_type === "openrouter") url = "https://openrouter.ai/api/v1/chat/completions"; else continue; }
    providers.push({ name: p.name, url, key: p.api_key, model: p.model || "gpt-4" });
  }
  if (providers.length === 0) return null;

  const body = (model: string) => ({
    model,
    messages: [
      { role: "system", content: "Extract structured restaurant/business data. Call the tool with accurate data from the website content." },
      { role: "user", content: `Extract structured data from this website.\n\nBusiness: ${businessName}\nCategory: ${category}\n\nContent:\n${websiteContent.substring(0, 10000)}` },
    ],
    tools: [{
      type: "function",
      function: {
        name: "extract_business_data",
        description: "Return structured business data",
        parameters: {
          type: "object",
          properties: {
            menu_items: { type: "array", items: { type: "object", properties: { name: { type: "string" }, price: { type: "string" }, category: { type: "string" }, description: { type: "string" } } } },
            categories: { type: "array", items: { type: "string" } },
            business_hours: { type: "string" },
            address: { type: "string" },
            phone: { type: "string" },
            email: { type: "string" },
            services: { type: "array", items: { type: "string" } },
            faq_topics: { type: "array", items: { type: "string" } },
            industry: { type: "string" },
            brand_tone: { type: "string" },
          },
          required: ["menu_items"],
          additionalProperties: false,
        },
      },
    }],
    tool_choice: { type: "function", function: { name: "extract_business_data" } },
  });

  for (const provider of providers) {
    try {
      console.log(`[llm] Trying ${provider.name}`);
      const res = await fetchWithTimeout(provider.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body(provider.model)),
      }, 60000);
      if (res.status === 429 || res.status === 402) { await res.text(); continue; }
      if (!res.ok) { await res.text(); continue; }
      const data = await res.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) return { ...JSON.parse(toolCall.function.arguments), _provider: provider.name };
    } catch { /* continue */ }
  }
  return null;
}

// ── Shared system prompt (restaurant-optimized) ──
function buildSystemPrompt(businessName: string, category: string, websiteContent: string, structuredData?: any, calendarUrl?: string) {
  const menu = structuredData?.menu_items || [];
  const hours = structuredData?.business_hours || "";
  const address = structuredData?.address || "";
  const phone = structuredData?.phone || "";
  const services = structuredData?.services || [];
  const faqs = structuredData?.faq_topics || [];

  const menuSection = menu.length > 0
    ? `\n### Menu\n${menu.map((item: any) => `- ${item.name}: ${item.price}${item.description ? ` — ${item.description}` : ""}`).join("\n")}`
    : "";

  const knowledgeBase = `## Business Information
- Name: ${businessName}
- Category: ${category}
${address ? `- Address: ${address}` : ""}
${phone ? `- Phone: ${phone}` : ""}
${hours ? `- Hours: ${hours}` : ""}
${services.length > 0 ? `- Services: ${services.join(", ")}` : ""}
${menuSection}
${faqs.length > 0 ? `\n### Common Questions\n${faqs.map((f: string) => `- ${f}`).join("\n")}` : ""}

### Additional Context
${websiteContent.substring(0, 3000)}`;

  const systemPrompt = `## Role & Identity
You are the AI assistant for ${businessName}. You are friendly, professional, and speak naturally.

## Core Tasks
A. Food Ordering:
   - Ask what items they'd like to order
   - Confirm quantities
   - Ask if delivery or pickup
   - If delivery, collect address
   - Repeat the order back for confirmation

B. Table Reservation:
   - Ask for preferred date
   - Ask for preferred time
   - Ask how many guests
   - Collect name and phone number
   - Confirm all details back
${calendarUrl ? `   - Direct them to book online: ${calendarUrl}` : ""}

C. General Inquiry:
   - Answer questions using the knowledge base
   - Keep responses concise
   - If you don't have the info, offer to connect with staff

## Conversation Style
- Speak naturally and warmly
- Keep responses concise
- Confirm details by repeating them back
- Be patient — if caller is unsure, offer suggestions

## Do's & Don'ts
DO: Stay in character, confirm before finalizing, offer alternatives, be proactive
DON'T: Make up information, discuss competitors, share internal data, rush the caller`;

  const firstMessage = `Hi, thank you for contacting ${businessName}! I can help you place an order, book a table, or answer any questions. What would you like to do?`;

  return { systemPrompt, firstMessage, knowledgeBase };
}

// ── Create VAPI Assistant ──
async function createVapiAssistant(systemPrompt: string, firstMessage: string, knowledgeBase: string, businessName: string): Promise<string> {
  const vapiKey = Deno.env.get("VAPI_API_KEY");
  if (!vapiKey) throw new Error("VAPI_API_KEY is not configured");

  const res = await fetchWithTimeout("https://api.vapi.ai/assistant", {
    method: "POST",
    headers: { Authorization: `Bearer ${vapiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: businessName.substring(0, 40),
      firstMessage,
      model: { provider: "openai", model: "gpt-4o", messages: [{ role: "system", content: `${systemPrompt}\n\n## Knowledge Base\n${knowledgeBase}` }] },
      voice: { provider: "azure", voiceId: "andrew" },
      endCallMessage: `Thank you for calling ${businessName}. Have a great day!`,
      maxDurationSeconds: 600,
      firstMessageMode: "assistant-speaks-first",
    }),
  }, 30000);

  if (!res.ok) { const err = await res.text(); throw new Error(`VAPI API error ${res.status}: ${err}`); }
  const data = await res.json();
  if (!data.id) throw new Error("VAPI response missing assistant id");
  return data.id;
}

// ── Main handler ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = getSupabase();

  try {
    const { businessName, websiteUrl, category, calendarUrl, origin, clientName, forceRefresh } = await req.json();

    if (!businessName || !websiteUrl) {
      return new Response(JSON.stringify({ error: "businessName and websiteUrl are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let formattedUrl = websiteUrl.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) formattedUrl = `https://${formattedUrl}`;
    const resolvedCategory = category || "Restaurant";

    await log(supabase, "ai_system_creation", "info", `Starting unified AI system for "${businessName}"`, { businessName, websiteUrl: formattedUrl });

    // Step 1: Scrape (cache-first)
    let websiteContent = "";
    let logoUrl: string | undefined;
    let structuredData: any = null;

    if (!forceRefresh) {
      const cached = await getCachedContent(supabase, formattedUrl);
      if (cached) { websiteContent = cached.content; logoUrl = cached.logoUrl; structuredData = cached.structured_data; }
    }

    if (!websiteContent) {
      try {
        const result = await scrapeWebsite(supabase, formattedUrl);
        websiteContent = result.content;
        logoUrl = result.logoUrl;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Scraping failed";
        await log(supabase, "ai_system_creation", "error", `Scrape failed: ${msg}`, { businessName });
        return new Response(JSON.stringify({ error: `Website scraping failed: ${msg}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Step 2: LLM extraction
    if (!structuredData?.menu_items?.length) {
      const llmData = await analyzeWithAI(supabase, businessName, resolvedCategory, websiteContent);
      if (llmData) structuredData = llmData;
    }

    // Save to cache
    await saveScrapeCache(supabase, formattedUrl, websiteContent, logoUrl, structuredData);

    // Step 3: Build ONE shared prompt
    const { systemPrompt, firstMessage, knowledgeBase } = buildSystemPrompt(
      businessName, resolvedCategory, websiteContent, structuredData, calendarUrl
    );

    // Step 4: Create VAPI voice assistant
    let assistantId: string;
    try {
      assistantId = await createVapiAssistant(systemPrompt, firstMessage, knowledgeBase, businessName);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "VAPI creation failed";
      await log(supabase, "ai_system_creation", "error", `VAPI failed: ${msg}`, { businessName });
      return new Response(JSON.stringify({ error: `VAPI assistant creation failed: ${msg}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Step 5: Create demo page
    const siteUrl = origin ? sanitizeOrigin(origin) : (Deno.env.get("SITE_URL") || "");
    const baseUrl = siteUrl.replace(/\/+$/, "");
    const vapiPublicKey = Deno.env.get("VAPI_API_KEY") || "";

    let demoSlug = slugify(clientName || businessName);
    if (!demoSlug) demoSlug = "demo";
    const { data: existingDemo } = await supabase.from("demo_pages").select("id").eq("slug", demoSlug).maybeSingle();
    if (existingDemo) demoSlug = `${demoSlug}-${randomSuffix()}`;

    const { data: demoPage, error: demoErr } = await supabase.from("demo_pages").insert({
      slug: demoSlug,
      assistant_id: assistantId,
      business_name: businessName,
      vapi_key: vapiPublicKey,
      client_name: clientName || null,
      company_name: businessName,
      industry: structuredData?.industry || resolvedCategory,
      calendly_url: calendarUrl || null,
      hero_title: `Your AI Receptionist for ${businessName} is Ready`,
      hero_subtitle: `We built a live AI that answers calls and chats for ${businessName} — try it now.`,
      contact_phone: structuredData?.phone || null,
      contact_email: structuredData?.email || null,
      custom_subdomain: demoSlug,
    }).select().single();

    if (demoErr) {
      console.error("Demo page insert error:", demoErr);
      return new Response(JSON.stringify({ error: "Failed to create demo page" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Step 6: Create chatbot (same prompt, same data)
    let chatbotSlug = slugify(businessName + "-chat");
    if (!chatbotSlug) chatbotSlug = "chatbot";
    const { data: existingChat } = await supabase.from("chatbots").select("id").eq("slug", chatbotSlug).maybeSingle();
    if (existingChat) chatbotSlug = `${chatbotSlug}-${randomSuffix()}`;

    const widgetConfig: any = {
      greeting: `Welcome to ${businessName}! How can I help you today?`,
      position: "bottom-right",
      logo: logoUrl || null,
    };
    if (calendarUrl) widgetConfig.calendarUrl = calendarUrl;

    const chatbotSystemPrompt = `${systemPrompt}\n\n## Knowledge Base\n${knowledgeBase}`;

    const { data: chatbot, error: chatErr } = await supabase.from("chatbots").insert({
      business_name: businessName,
      website_url: formattedUrl,
      slug: chatbotSlug,
      system_prompt: chatbotSystemPrompt,
      industry: structuredData?.industry || resolvedCategory,
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
    }).select().single();

    if (chatErr) {
      console.error("Chatbot insert error:", chatErr);
      return new Response(JSON.stringify({ error: "Failed to create chatbot" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await log(supabase, "ai_system_creation", "success", `Full AI system created for "${businessName}"`, {
      assistantId, demoSlug, chatbotSlug, hasLogo: !!logoUrl,
    });

    return new Response(JSON.stringify({
      success: true,
      businessName,
      voiceAgent: {
        assistantId,
        demoPage: {
          slug: demoSlug,
          url: baseUrl ? `${baseUrl}/${demoSlug}` : `/${demoSlug}`,
          id: demoPage.id,
        },
      },
      chatbot: {
        slug: chatbotSlug,
        url: baseUrl ? `${baseUrl}/chatbot/${chatbotSlug}` : `/chatbot/${chatbotSlug}`,
        id: chatbot.id,
      },
      meta: {
        logoUrl: logoUrl || null,
        industry: structuredData?.industry || resolvedCategory,
        menuItemsCount: structuredData?.menu_items?.length || 0,
      },
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("Unexpected error:", err);
    await log(supabase, "ai_system_creation", "error", `Unexpected: ${msg}`, {});
    return new Response(JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
