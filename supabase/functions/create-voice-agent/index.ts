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

// ── Firecrawl scraping with failover ──
async function scrapeWebsite(supabase: any, websiteUrl: string): Promise<string> {
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
        body: JSON.stringify({ url: websiteUrl, formats: ["markdown"], onlyMainContent: true }),
      }, 25000);

      if (res.status === 402) { lastError = `${source}: credits exhausted`; await res.text(); continue; }
      if (!res.ok) { lastError = `${source}: ${res.status}`; await res.text(); continue; }

      const data = await res.json();
      const content = data.data?.markdown || data.markdown || "";
      await log(supabase, "voice_agent_scrape", "success", `Scraped ${content.length} chars via ${source}`, { source });
      return content;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = msg.includes("abort") ? `${source}: timeout` : msg;
    }
  }
  throw new Error(`All Firecrawl keys failed. Last: ${lastError}`);
}

// ── LLM: generate structured voice agent prompt ──
async function generateVoicePrompt(
  supabase: any,
  businessName: string,
  category: string,
  websiteContent: string,
): Promise<{ systemPrompt: string; firstMessage: string; knowledgeBase: string }> {
  // Collect providers
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
  if (providers.length === 0) throw new Error("No AI providers configured");

  const userPrompt = `Analyze this business and generate a production-quality AI voice assistant configuration.

Business Name: ${businessName}
Category: ${category}

Website Content (scraped):
${websiteContent.substring(0, 10000)}

Generate:
1. A comprehensive system prompt for a phone voice assistant with: Role & Identity, Core Tasks, Conversation Style, Do's & Don'ts, Error Handling instructions.
2. A warm first message greeting.
3. A knowledge base summary with key business info (services, pricing, FAQs, contact details).`;

  const body = (model: string) => ({
    model,
    messages: [
      {
        role: "system",
        content: "You are an expert at creating production-quality AI voice assistant configurations. Generate detailed, business-specific content. The system prompt must be comprehensive — covering identity, tasks, tone, boundaries, and error handling. Call the provided tool with the result.",
      },
      { role: "user", content: userPrompt },
    ],
    tools: [{
      type: "function",
      function: {
        name: "create_voice_config",
        description: "Return the voice assistant configuration",
        parameters: {
          type: "object",
          properties: {
            systemPrompt: { type: "string", description: "Complete system prompt with Role, Identity, Tasks, Do's & Don'ts, Error Handling" },
            firstMessage: { type: "string", description: "Warm greeting message the assistant says first" },
            knowledgeBase: { type: "string", description: "Structured knowledge base with services, pricing, FAQs, contact info" },
          },
          required: ["systemPrompt", "firstMessage", "knowledgeBase"],
          additionalProperties: false,
        },
      },
    }],
    tool_choice: { type: "function", function: { name: "create_voice_config" } },
  });

  let lastError = "";
  for (const provider of providers) {
    try {
      console.log(`[llm] Trying ${provider.name}`);
      const res = await fetchWithTimeout(provider.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body(provider.model)),
      }, 60000);

      if (res.status === 429 || res.status === 402) { lastError = `${provider.name}: ${res.status}`; await res.text(); continue; }
      if (!res.ok) { lastError = `${provider.name}: ${res.status}`; await res.text(); continue; }

      const data = await res.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        const result = JSON.parse(toolCall.function.arguments);
        await log(supabase, "voice_agent_llm", "success", `Prompt generated via ${provider.name}`, { provider: provider.name });
        return result;
      }
      lastError = `${provider.name}: no tool call`;
    } catch (err) {
      lastError = `${provider.name}: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  // Fallback
  await log(supabase, "voice_agent_llm", "warn", `All AI providers failed, using fallback. Last: ${lastError}`, {});
  return {
    systemPrompt: `You are a professional AI phone assistant for ${businessName}, a ${category} business. Help callers with inquiries about services, scheduling, and general information. Be polite, professional, and concise. If you don't know something, offer to connect the caller with a team member.`,
    firstMessage: `Hello! Thank you for calling ${businessName}. How can I help you today?`,
    knowledgeBase: websiteContent.substring(0, 3000),
  };
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

  // Combine system prompt + knowledge base
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
    endCallMessage: `Thank you for calling ${businessName}. Goodbye!`,
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
    const { businessName, category, websiteUrl } = await req.json();

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

    // Step 1: Scrape
    let websiteContent: string;
    try {
      websiteContent = await scrapeWebsite(supabase, formattedUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scraping failed";
      await log(supabase, "voice_agent_creation", "error", `Scrape failed: ${msg}`, { businessName });
      return new Response(
        JSON.stringify({ error: `Website scraping failed: ${msg}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Step 2: Generate prompt via LLM
    const { systemPrompt, firstMessage, knowledgeBase } = await generateVoicePrompt(supabase, businessName, category, websiteContent);

    // Step 3: Create VAPI assistant
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
