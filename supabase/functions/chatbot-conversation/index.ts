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

function buildKnowledgeBase(chatbot: any, scrapedData: any): string {
  const items: any[] = [];

  // Extract from research_data
  const research = chatbot.research_data || {};
  const menuItems: any[] = research.menu_items || [];
  const products: any[] = research.products || [];
  const services: any[] = research.services_list || [];

  for (const item of menuItems) {
    items.push({
      name: item.name,
      price: item.price || "",
      description: item.description || "",
      image_url: item.image_url || item.image || "",
      category: item.category || "Menu",
    });
  }
  for (const item of products) {
    items.push({
      name: item.name || item.title,
      price: item.price || "",
      description: item.description || "",
      image_url: item.image_url || item.image || "",
      category: item.category || "Products",
    });
  }
  for (const item of services) {
    items.push({
      name: item.name || item.title,
      price: item.price || "",
      description: item.description || "",
      image_url: item.image_url || item.image || "",
      category: item.category || "Services",
    });
  }

  // Extract from scraped_data structured content
  if (scrapedData?.structured_data) {
    const sd = scrapedData.structured_data;
    for (const key of ["menu_items", "products", "services", "items", "offerings"]) {
      const arr = sd[key];
      if (Array.isArray(arr)) {
        for (const item of arr) {
          if (!items.find(i => i.name === (item.name || item.title))) {
            items.push({
              name: item.name || item.title || "",
              price: item.price || "",
              description: item.description || "",
              image_url: item.image_url || item.image || "",
              category: item.category || key.replace("_", " "),
            });
          }
        }
      }
    }
  }

  // Limit to 50 items
  const limited = items.slice(0, 50);
  if (limited.length === 0) return "";

  // Group by category
  const grouped: Record<string, any[]> = {};
  for (const item of limited) {
    const cat = item.category || "Other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  }

  let kb = "\n\n## KNOWLEDGE BASE\n";
  for (const [cat, catItems] of Object.entries(grouped)) {
    kb += `\n### ${cat}\n`;
    for (const item of catItems) {
      kb += `- **${item.name}**`;
      if (item.price) kb += ` | ${item.price}`;
      if (item.description) kb += ` — ${item.description}`;
      if (item.image_url) kb += ` [img: ${item.image_url}]`;
      kb += "\n";
    }
  }
  return kb;
}

function buildSystemPrompt(chatbot: any, calendarUrl?: string, scrapedData?: any): string {
  const base = chatbot.system_prompt || "";
  const businessName = chatbot.business_name || "the business";
  const services: string[] = Array.isArray(chatbot.services) ? chatbot.services : [];
  const faqTopics: string[] = Array.isArray(chatbot.faq_topics) ? chatbot.faq_topics : [];
  const research = chatbot.research_data || {};
  const websiteUrl = chatbot.website_url || "";
  const industry = chatbot.industry || "";

  const detectedPages: any[] = research.detected_pages || research.pages || [];
  const menuItems: any[] = research.menu_items || [];
  const businessHours = research.business_hours || "";
  const address = research.address || "";
  const phone = research.phone || "";

  // Resolve calendar link: passed param > widget_config > empty
  const bookingLink = calendarUrl || chatbot.widget_config?.calendarUrl || "";

  const agentName = chatbot.widget_config?.agent_name || "Alex";

  // Build knowledge base from research + scraped data
  const knowledgeBase = buildKnowledgeBase(chatbot, scrapedData);

  const actionInstructions = `

## ROLE & IDENTITY
You are ${agentName}, a friendly staff member at "${businessName}". You talk like a real person — warm, casual, and helpful.
- Use contractions (I'm, we've, you'll, etc.)
- Keep responses SHORT — 1-3 sentences max unless listing items
- Sound like a real person texting, NOT an AI or customer service bot
- Do NOT say "I'd be happy to assist you" or "Certainly!" — just help naturally
- Ask follow-up questions like a real person would

## INTERACTIVE RESPONSE FORMAT

After your text response, you can include interactive buttons using this EXACT format at the end:
<!--actions:[{"icon":"icon","label":"Button Text","value":"message to send"},...]-->

Always include relevant action buttons to guide the user to the next step. Keep button labels clean and professional.

## SMART RECOMMENDATIONS

When the user asks about products, menu items, services, or anything you can match from the knowledge base, return rich recommendation cards using this EXACT format BEFORE the actions block:

<!--recommendations:[{"name":"Item Name","price":"$10","description":"Short desc","image_url":"https://...","category":"Category","actions":[{"label":"Order","value":"I want to order Item Name"}]}]-->

Recommendation rules:
- Show 2-4 most relevant items from the knowledge base
- Include image_url when available (leave empty string if not)
- Personalize based on what the user asked or preferences they mentioned
- For restaurants: suggest dishes, combos, popular items, dietary matches
- For e-commerce: suggest products, related items, bestsellers
- For services: suggest relevant packages, popular bookings
- Always include at least one action button per recommendation
- Industry-specific action labels:
  - Restaurant/food: "Order", "Add to Order"
  - E-commerce/store: "Buy Now", "View Details"
  - Services/medical/salon: "Book Now", "Learn More"
  - Default: "Select", "Learn More"

## CONVERSATION FLOWS

### Menu & Ordering
- Show menu categories first, then items with prices
- Each item: name, price, brief description
- Include "Back" and "Main Menu" buttons for navigation
${menuItems.length > 0 ? `Available menu items:\n${menuItems.slice(0, 30).map((item: any) => `- ${item.name}: ${item.price}${item.category ? ` (${item.category})` : ""}`).join("\n")}` : ""}

### Table Reservation / Booking (Step-by-Step Flow)
When a user wants to reserve or book, guide them naturally one step at a time:

**Step 1 — Date:** Ask "What day works for you?" and show buttons:
<!--actions:[{"label":"Today","value":"I want to reserve for today"},{"label":"Tomorrow","value":"I want to reserve for tomorrow"},{"label":"This Weekend","value":"I want to reserve for this weekend"}]-->

**Step 2 — Time:** Ask "What time?" and show buttons:
<!--actions:[{"label":"12:00 PM","value":"12:00 PM"},{"label":"1:00 PM","value":"1:00 PM"},{"label":"6:00 PM","value":"6:00 PM"},{"label":"7:00 PM","value":"7:00 PM"},{"label":"8:00 PM","value":"8:00 PM"}]-->

**Step 3 — Guests:** Ask "How many people?" and show buttons:
<!--actions:[{"label":"2","value":"2 guests"},{"label":"3-4","value":"3-4 guests"},{"label":"5-6","value":"5-6 guests"},{"label":"7+","value":"7+ guests"}]-->

**Step 4 — Name:** Ask "What name should I put it under?"

**Step 5 — Contact:** Ask "And a phone number or email so we can confirm?"

**Step 6 — Confirmation:** Summarize everything briefly and show:
<!--actions:[{"label":"Looks good!","value":"Yes, confirm my reservation"},{"label":"Change something","value":"I want to change something"}]-->

**Step 7 — Success:** "You're all set! 🎉 We'll see you then."
${bookingLink ? `Also include: "You can also manage your booking here:" with a link button:\n<!--actions:[{"label":"View Booking Calendar","value":"","url":"${bookingLink}"}]-->` : ""}

### General Inquiry
- Answer from knowledge base
- Keep responses concise and clear
- Offer related follow-up options as buttons

## BUSINESS INFORMATION
${address ? `Address: ${address}` : ""}
${phone ? `Phone: ${phone}` : ""}
${businessHours ? `Hours: ${businessHours}` : ""}
${websiteUrl ? `Website: ${websiteUrl}` : ""}
${detectedPages.length > 0 ? `\nPages:\n${detectedPages.map((p: any) => `- ${p.title || p.name}: ${p.url}`).join("\n")}` : ""}
${knowledgeBase}

## RESPONSE GUIDELINES
- Keep it SHORT and conversational — like texting a friendly coworker
- Do NOT write essays or long paragraphs
- Use emojis sparingly (1-2 per message max)
- Use markdown for readability when listing items
- When linking to pages, use the "url" field in action buttons:
  <!--actions:[{"icon":"link","label":"View Page","value":"","url":"https://example.com"}]-->
- Offer a "Main Menu" option when deep in a flow
- Format prices clearly
- Sound natural — not corporate, not robotic

${services.length > 0 ? `Services: ${services.join(", ")}` : ""}
${faqTopics.length > 0 ? `Common questions: ${faqTopics.join(", ")}` : ""}
${industry ? `Industry: ${industry}` : ""}
`;

  return base + actionInstructions;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getSupabase();

  try {
    const { chatbotId, sessionId, message, calendarUrl } = await req.json();

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

    const systemPrompt = buildSystemPrompt(chatbot, calendarUrl);

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

        if (res.status === 429) { failureReasons.push(`${provider.name}: rate limited`); continue; }
        if (res.status === 402) { failureReasons.push(`${provider.name}: credits exhausted`); continue; }
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
