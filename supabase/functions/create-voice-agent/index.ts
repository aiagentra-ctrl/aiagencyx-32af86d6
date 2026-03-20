import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getSupabase() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

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

// ── Check scraped_data cache ──
async function getCachedContent(supabase: any, websiteUrl: string): Promise<{ content: string; logoUrl?: string; structured_data?: any } | null> {
  const { data } = await supabase
    .from("scraped_data")
    .select("*")
    .eq("website_url", websiteUrl)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (data) {
    console.log(`[cache] Hit for ${websiteUrl}`);
    return { content: data.raw_content || "", logoUrl: data.logo_url || undefined, structured_data: data.structured_data };
  }
  return null;
}

async function saveScrapeCache(supabase: any, websiteUrl: string, content: string, logoUrl?: string) {
  await supabase.from("scraped_data").upsert({
    website_url: websiteUrl,
    raw_content: content,
    logo_url: logoUrl || null,
    scraped_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  }, { onConflict: "website_url" });
}

// ── Firecrawl scraping with failover ──
async function scrapeWebsite(supabase: any, websiteUrl: string): Promise<{ content: string; logoUrl?: string }> {
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
    for (const p of firecrawlProviders) keys.push({ key: p.api_key, source: p.name });
  }
  if (keys.length === 0) throw new Error("No Firecrawl API keys configured");

  let lastError = "";
  for (const { key, source } of keys) {
    try {
      console.log(`[scrape] Trying Firecrawl key: ${source}`);
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
      await log(supabase, "voice_agent_scrape", "success", `Scraped ${content.length} chars via ${source}`, { source, hasLogo: !!logoUrl });
      return { content, logoUrl };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = msg.includes("abort") ? `${source}: timeout` : msg;
    }
  }
  throw new Error(`All Firecrawl keys failed. Last: ${lastError}`);
}

// ── Build restaurant-specific voice prompt ──
function buildRestaurantPrompt(businessName: string, category: string, websiteContent: string, structuredData?: any, calendarUrl?: string): {
  systemPrompt: string; firstMessage: string; knowledgeBase: string;
} {
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
You are the AI phone assistant for ${businessName}. You are friendly, professional, and speak naturally like a real team member.

## Core Tasks
A. Food Ordering:
   - Ask what items they'd like to order
   - Confirm quantities
   - Ask if delivery or pickup
   - If delivery, collect address
   - Repeat the order back for confirmation
   - Provide estimated time if possible

B. Table Reservation:
   - Ask for preferred date
   - Ask for preferred time
   - Ask how many guests
   - Collect name and phone number
   - Confirm all details back to the caller
${calendarUrl ? `   - If they want to book online, direct them to: ${calendarUrl}` : ""}

C. General Inquiry:
   - Answer questions using the knowledge base below
   - Keep responses concise (2-3 sentences max for voice)
   - If you don't have the info, offer to connect with staff

## Conversation Style
- Speak naturally and warmly — avoid robotic or scripted language
- Keep responses under 2-3 sentences for clarity on phone
- Confirm details by repeating them back
- Use natural transitions: "Great choice!", "Sure thing!", "Let me help with that"
- Be patient — if caller is unsure, offer suggestions

## Do's & Don'ts
DO:
- Stay in character as a helpful team member
- Confirm before finalizing any order or reservation
- Offer alternatives when something is unavailable
- Be proactive: "Would you like anything else?"

DON'T:
- Make up information not in the knowledge base
- Discuss competitors or unrelated topics
- Share internal business data
- Rush the caller

## Error Handling
- If you can't hear clearly: "I'm sorry, could you repeat that?"
- If asked something outside your scope: "That's a great question. I'd recommend speaking with our team directly. Would you like their phone number?"
- If the caller seems frustrated: "I apologize for the inconvenience. Let me see how I can help."`;

  const firstMessage = `Hi, thank you for calling ${businessName}! I can help you place an order, book a table, or answer any questions you might have. What would you like to do?`;

  return { systemPrompt, firstMessage, knowledgeBase };
}

// ── LLM: enhance prompt with scraped content (optional) ──
async function enhanceWithLLM(
  supabase: any,
  businessName: string,
  category: string,
  websiteContent: string,
): Promise<{ systemPrompt: string; firstMessage: string; knowledgeBase: string } | null> {
  const { data: llmProviders } = await supabase
    .from("api_providers")
    .select("*")
    .eq("category", "llm")
    .eq("is_enabled", true)
    .order("priority", { ascending: true });

  interface P { name: string; url: string; key: string; model: string }
  const providers: P[] = [];

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
        if (p.provider_type === "openai") url = "https://api.openai.com/v1/chat/completions";
        else if (p.provider_type === "openrouter") url = "https://openrouter.ai/api/v1/chat/completions";
        else continue;
      }
      providers.push({ name: p.name, url, key: p.api_key, model: p.model || "gpt-4" });
    }
  }
  if (providers.length === 0) return null;

  const userPrompt = `Extract structured restaurant data from this website content. Return menu items with prices, business hours, address, phone, and key FAQs.

Business: ${businessName}
Category: ${category}

Website Content:
${websiteContent.substring(0, 10000)}`;

  const body = (model: string) => ({
    model,
    messages: [
      { role: "system", content: "Extract structured restaurant data. Call the tool with accurate data from the website content." },
      { role: "user", content: userPrompt },
    ],
    tools: [{
      type: "function",
      function: {
        name: "extract_restaurant_data",
        description: "Return structured restaurant data",
        parameters: {
          type: "object",
          properties: {
            menu_items: {
              type: "array",
              items: { type: "object", properties: { name: { type: "string" }, price: { type: "string" }, category: { type: "string" }, description: { type: "string" } } },
            },
            business_hours: { type: "string" },
            address: { type: "string" },
            phone: { type: "string" },
            services: { type: "array", items: { type: "string" } },
            faq_topics: { type: "array", items: { type: "string" } },
          },
          required: ["menu_items"],
          additionalProperties: false,
        },
      },
    }],
    tool_choice: { type: "function", function: { name: "extract_restaurant_data" } },
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
      if (toolCall?.function?.arguments) {
        const result = JSON.parse(toolCall.function.arguments);
        return result;
      }
    } catch { /* continue */ }
  }
  return null;
}

// ── Create VAPI Assistant ──
async function createVapiAssistant(
  systemPrompt: string,
  firstMessage: string,
  knowledgeBase: string,
  businessName: string,
): Promise<string> {
  const vapiKey = Deno.env.get("VAPI_API_KEY");
  if (!vapiKey) throw new Error("VAPI_API_KEY is not configured");

  const fullPrompt = `${systemPrompt}\n\n## Knowledge Base\n${knowledgeBase}`;

  const payload = {
    name: businessName.substring(0, 40),
    firstMessage,
    model: {
      provider: "openai",
      model: "gpt-4o",
      messages: [{ role: "system", content: fullPrompt }],
    },
    voice: {
      provider: "azure",
      voiceId: "andrew",
    },
    endCallMessage: `Thank you for calling ${businessName}. Have a great day!`,
    maxDurationSeconds: 600,
    firstMessageMode: "assistant-speaks-first",
  };

  console.log("[vapi] Creating assistant...");
  const res = await fetchWithTimeout("https://api.vapi.ai/assistant", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${vapiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }, 30000);

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`VAPI API error ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  const assistantId = data.id;
  if (!assistantId) throw new Error("VAPI response missing assistant id");
  return assistantId;
}

// ── Main handler ──
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getSupabase();

  try {
    const { businessName, category, websiteUrl, forceRefresh, calendarUrl } = await req.json();

    if (!businessName || !category || !websiteUrl) {
      return new Response(
        JSON.stringify({ error: "businessName, category, and websiteUrl are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let formattedUrl = websiteUrl.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    await log(supabase, "voice_agent_creation", "info", `Starting voice agent for "${businessName}"`, { businessName, category, websiteUrl: formattedUrl });

    // Step 1: Check cache first
    let websiteContent: string | null = null;
    let structuredData: any = null;

    if (!forceRefresh) {
      const cached = await getCachedContent(supabase, formattedUrl);
      if (cached) {
        websiteContent = cached.content;
        structuredData = cached.structured_data;
      }
    }

    if (!websiteContent) {
      try {
        websiteContent = await scrapeWebsite(supabase, formattedUrl);
        await saveScrapeCache(supabase, formattedUrl, websiteContent);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Scraping failed";
        await log(supabase, "voice_agent_creation", "error", `Scrape failed: ${msg}`, { businessName });
        return new Response(
          JSON.stringify({ error: `Website scraping failed: ${msg}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Step 2: Try LLM extraction if no structured data
    if (!structuredData || !structuredData.menu_items?.length) {
      const llmData = await enhanceWithLLM(supabase, businessName, category, websiteContent);
      if (llmData) {
        structuredData = llmData;
        await supabase.from("scraped_data").update({
          structured_data: structuredData,
        }).eq("website_url", formattedUrl);
      }
    }

    // Step 3: Build prompt (restaurant-optimized, with calendar link)
    const { systemPrompt, firstMessage, knowledgeBase } = buildRestaurantPrompt(
      businessName, category, websiteContent, structuredData, calendarUrl
    );

    // Step 4: Create VAPI assistant
    let assistantId: string;
    try {
      assistantId = await createVapiAssistant(systemPrompt, firstMessage, knowledgeBase, businessName);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "VAPI creation failed";
      await log(supabase, "voice_agent_creation", "error", `VAPI failed: ${msg}`, { businessName });
      return new Response(
        JSON.stringify({ error: `VAPI assistant creation failed: ${msg}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await log(supabase, "voice_agent_creation", "success", `Voice agent created: ${assistantId}`, { businessName, assistantId });

    return new Response(
      JSON.stringify({ assistantId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("Unexpected error:", err);
    await log(supabase, "voice_agent_creation", "error", `Unexpected: ${msg}`, {});
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
