import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getSupabase() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
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

interface AIProvider {
  name: string;
  url: string;
  key: string;
  model: string;
}

async function getProviders(supabase: any, chatbot: any): Promise<AIProvider[]> {
  const providers: AIProvider[] = [];

  if (chatbot.ai_provider !== "lovable" && chatbot.api_key_encrypted) {
    let url: string;
    switch (chatbot.ai_provider) {
      case "openai": url = "https://api.openai.com/v1/chat/completions"; break;
      case "openrouter": url = "https://openrouter.ai/api/v1/chat/completions"; break;
      default: url = "https://api.openai.com/v1/chat/completions";
    }
    providers.push({
      name: `Chatbot: ${chatbot.ai_provider}`,
      url,
      key: chatbot.api_key_encrypted,
      model: chatbot.ai_model || "gpt-4",
    });
  }

  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) {
    providers.push({
      name: "Lovable AI",
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      key: lovableKey,
      model: chatbot.ai_provider === "lovable" ? (chatbot.ai_model || "google/gemini-3-flash-preview") : "google/gemini-3-flash-preview",
    });
  }

  const { data: dbProviders } = await supabase
    .from("api_providers")
    .select("*")
    .eq("category", "llm")
    .eq("is_enabled", true)
    .order("priority", { ascending: true });

  if (dbProviders) {
    for (const p of dbProviders) {
      let url = p.endpoint_url;
      if (!url) {
        switch (p.provider_type) {
          case "openai": url = "https://api.openai.com/v1/chat/completions"; break;
          case "openrouter": url = "https://openrouter.ai/api/v1/chat/completions"; break;
          default: continue;
        }
      }
      if (!providers.find((x) => x.key === p.api_key)) {
        providers.push({ name: p.name, url, key: p.api_key, model: p.model || "gpt-4" });
      }
    }
  }

  return providers;
}

/**
 * Build an enhanced system prompt that includes restaurant-specific instructions
 * for structured button output and dynamic conversation flows.
 */
function buildSystemPrompt(chatbot: any): string {
  const base = chatbot.system_prompt || "";
  const businessName = chatbot.business_name || "the business";
  const services: string[] = Array.isArray(chatbot.services) ? chatbot.services : [];
  const faqTopics: string[] = Array.isArray(chatbot.faq_topics) ? chatbot.faq_topics : [];
  const research = chatbot.research_data || {};
  const websiteUrl = chatbot.website_url || "";
  const industry = chatbot.industry || "";

  // Extract detected pages from research data
  const detectedPages: any[] = research.detected_pages || research.pages || [];
  const menuItems: any[] = research.menu_items || research.products || [];

  const actionInstructions = `

## INTERACTIVE RESPONSE FORMAT

You are an AI assistant for "${businessName}". You MUST follow these rules:

1. After your text response, you can include interactive buttons by appending this EXACT format at the very end:
<!--actions:[{"icon":"emoji","label":"Button Text","value":"message to send"},...]-->

2. ALWAYS include relevant action buttons to guide the user. Never leave a response without suggested next steps.

3. For restaurant/food businesses, use these conversation flows:

### Welcome / Main Menu
After greeting, suggest: View Menu, Order Food, Reserve Table, Location & Hours, Today's Offers

### Menu Browsing
- Show categories first (Pizza, Burgers, Drinks, etc.)
- Then show items with prices
- Each item should have: Add to Cart, Customize, Back buttons
${menuItems.length > 0 ? `- Known menu items: ${JSON.stringify(menuItems.slice(0, 20))}` : ""}

### Ordering Flow
- Ask: Delivery or Pickup?
- Let user select items
- Show cart summary
- Ask for delivery address if delivery
- Confirm order

### Reservation Flow
- Ask: Date → Time → Number of guests → Contact info
- Confirm reservation details

### Location & Hours
- Show address and hours
- Offer: Open in Maps, Call Restaurant buttons

4. When linking to real pages on the client website, use the "url" field:
<!--actions:[{"icon":"🔗","label":"View Full Menu","value":"","url":"https://example.com/menu"}]-->

${websiteUrl ? `Client website: ${websiteUrl}` : ""}
${detectedPages.length > 0 ? `Detected pages from client website:\n${detectedPages.map((p: any) => `- ${p.title || p.name}: ${p.url}`).join("\n")}` : ""}

5. Keep responses concise and friendly. Use emojis naturally.

6. Format menu items nicely with emoji, name, price, and brief description.

7. Always include a "🔙 Back" or "🏠 Main Menu" button option when deep in a flow.

${services.length > 0 ? `\nServices offered: ${services.join(", ")}` : ""}
${faqTopics.length > 0 ? `\nCommon questions: ${faqTopics.join(", ")}` : ""}
${industry ? `\nIndustry: ${industry}` : ""}
`;

  return base + actionInstructions;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getSupabase();

  try {
    const { chatbotId, sessionId, message } = await req.json();

    if (!chatbotId || !sessionId || !message) {
      return new Response(
        JSON.stringify({ error: "chatbotId, sessionId, and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: chatbot, error: chatbotError } = await supabase
      .from("chatbots")
      .select("*")
      .eq("id", chatbotId)
      .single();

    if (chatbotError || !chatbot) {
      return new Response(
        JSON.stringify({ error: "Chatbot not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let { data: conversation } = await supabase
      .from("chatbot_conversations")
      .select("*")
      .eq("chatbot_id", chatbotId)
      .eq("session_id", sessionId)
      .maybeSingle();

    const existingMessages = (conversation?.messages as any[]) || [];
    const updatedMessages = [
      ...existingMessages,
      { role: "user", content: message, timestamp: new Date().toISOString() },
    ];

    const systemPrompt = buildSystemPrompt(chatbot);

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...updatedMessages.map((m: any) => ({ role: m.role, content: m.content })),
    ];

    const providers = await getProviders(supabase, chatbot);
    if (providers.length === 0) {
      return new Response(
        JSON.stringify({ error: "No AI providers configured." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let aiRes: Response | null = null;
    let usedProvider = "";
    const failureReasons: string[] = [];

    for (const provider of providers) {
      try {
        console.log(`Chat: trying ${provider.name}`);
        const res = await fetchWithTimeout(provider.url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ model: provider.model, messages: aiMessages, stream: true }),
        }, 30000);

        if (res.status === 429) {
          failureReasons.push(`${provider.name}: rate limited`);
          continue;
        }
        if (res.status === 402) {
          failureReasons.push(`${provider.name}: credits exhausted`);
          continue;
        }
        if (!res.ok) {
          const errText = await res.text();
          failureReasons.push(`${provider.name}: HTTP ${res.status}`);
          console.log(`${provider.name}: ${res.status} - ${errText.substring(0, 200)}`);
          continue;
        }

        aiRes = res;
        usedProvider = provider.name;
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "error";
        failureReasons.push(`${provider.name}: ${msg.includes("abort") ? "timeout" : msg}`);
      }
    }

    if (!aiRes) {
      const allCreditsExhausted = failureReasons.every(r => r.includes("credits exhausted"));
      const errorMsg = allCreditsExhausted
        ? "AI credits exhausted. Please add a backup API provider."
        : `All AI providers failed: ${failureReasons.join("; ")}`;

      return new Response(
        JSON.stringify({ error: errorMsg, details: failureReasons }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Stream response and capture full content
    let fullResponse = "";
    const { readable, writable } = new TransformStream({
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk);
        for (const line of text.split("\n")) {
          if (line.startsWith("data: ") && line.slice(6).trim() !== "[DONE]") {
            try {
              const parsed = JSON.parse(line.slice(6));
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) fullResponse += content;
            } catch { /* ignore partial JSON */ }
          }
        }
        controller.enqueue(chunk);
      },
      async flush() {
        const finalMessages = [
          ...updatedMessages,
          { role: "assistant", content: fullResponse, timestamp: new Date().toISOString() },
        ];
        if (conversation) {
          await supabase
            .from("chatbot_conversations")
            .update({ messages: finalMessages, updated_at: new Date().toISOString() })
            .eq("id", conversation.id);
        } else {
          await supabase.from("chatbot_conversations").insert({
            chatbot_id: chatbotId,
            session_id: sessionId,
            messages: finalMessages,
          });
        }
      },
    });

    aiRes.body!.pipeTo(writable);

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
