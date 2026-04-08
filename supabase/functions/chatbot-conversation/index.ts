import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Module-level client reuse — Deno.serve keeps the module alive across requests
const supabaseClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

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

function detectIndustry(industry: string): string {
  const li = (industry || "").toLowerCase();
  if (["dental", "clinic", "dentist", "healthcare", "medical", "doctor", "orthodont"].some(k => li.includes(k))) return "dental";
  if (["restaurant", "food", "cafe", "pizza", "bakery", "diner", "grill", "bistro", "sushi", "burger", "taco"].some(k => li.includes(k))) return "restaurant";
  if (["salon", "spa", "beauty", "barber", "hair"].some(k => li.includes(k))) return "salon";
  if (["real_estate", "property", "realty", "realtor"].some(k => li.includes(k))) return "realestate";
  if (["law", "legal", "attorney", "lawyer"].some(k => li.includes(k))) return "legal";
  if (["ecommerce", "shop", "store", "retail"].some(k => li.includes(k))) return "ecommerce";
  return "general";
}

function buildDentalChatbotFlow(bookingLink: string): string {
  return `
[APPOINTMENT BOOKING FLOW]
Trigger: User wants to book, schedule, or make an appointment.

Step 1 — Identify Need:
"What brings you in? A cleaning, checkup, or something specific?"
<!--actions:[{"label":"Cleaning","value":"I need a dental cleaning"},{"label":"Checkup","value":"I need a dental checkup"},{"label":"Toothache","value":"I have a toothache"},{"label":"Other","value":"I have another dental concern"}]-->
<wait for response>

Step 2 — Preferred Date:
"When works best for you?"
<!--actions:[{"label":"Today","value":"I want to come in today"},{"label":"Tomorrow","value":"Tomorrow works"},{"label":"This Week","value":"Sometime this week"},{"label":"Next Week","value":"Next week"}]-->
<wait for response>

Step 3 — Preferred Time:
"Morning or afternoon?"
<!--actions:[{"label":"Morning (9-12)","value":"Morning please"},{"label":"Afternoon (1-5)","value":"Afternoon works"},{"label":"Evening (5-7)","value":"Evening if available"}]-->
<wait for response>

Step 4 — Patient Name:
"What name should I put the appointment under?"
<wait for response>

Step 5 — Contact Info:
"And a phone number or email so we can confirm?"
<wait for response>

Step 6 — Insurance:
"Do you have dental insurance? If so, which provider?"
<!--actions:[{"label":"Yes","value":"Yes I have insurance"},{"label":"No Insurance","value":"No insurance"},{"label":"Not Sure","value":"I'm not sure about my insurance"}]-->
<wait for response>

Step 7 — Confirmation:
Summarize: dental issue, date, time, name, contact, insurance.
"Here's what I have: [summary]. Does everything look right?"
<!--actions:[{"label":"Confirm Appointment","value":"Yes, confirm my appointment"},{"label":"Change Something","value":"I need to change something"}]-->
<wait for response>

Step 8 — Success:
"You're all set! 🎉 Please arrive 10-15 minutes early for paperwork. We'll send a confirmation shortly. Is there anything else I can help with?"
${bookingLink ? `<!--actions:[{"label":"View Calendar","value":"","url":"${bookingLink}"},{"label":"All Done","value":"That's all, thanks!"}]-->` : `<!--actions:[{"label":"Ask a Question","value":"I have a question"},{"label":"All Done","value":"That's all, thanks!"}]-->`}`;
}

function buildRestaurantChatbotFlow(bookingLink: string, menuItems: any[]): string {
  return `
[ORDERING FLOW]
Trigger: User wants to order food.

Step 1: "What are you in the mood for today?"
<!--actions:[{"label":"See Menu","value":"Show me the menu"},{"label":"Popular Items","value":"What's popular?"},{"label":"Specials","value":"Any specials today?"}]-->
<wait for response>

Step 2: Suggest 2-3 items from knowledge base matching their preference. Include recommendations block.
<wait for response>

Step 3: "Great choice! Want to add a side or drink?"
<wait for response>

Step 4: "Any allergies or special requests?"
<wait for response>

Step 5: Summarize order with total. "Sound right?"
<!--actions:[{"label":"Looks Good!","value":"Yes, confirm my order"},{"label":"Change Something","value":"I want to change something"}]-->
<wait for response>

Step 6: "Pickup or delivery?"
<!--actions:[{"label":"Pickup","value":"Pickup"},{"label":"Delivery","value":"Delivery"}]-->
<wait for response>

Step 7: "You're all set! Your order will be ready soon. Anything else?"

[TABLE RESERVATION FLOW]
Trigger: User wants to reserve a table.

Step 1 — Date: "What day works for you?"
<!--actions:[{"label":"Today","value":"Today"},{"label":"Tomorrow","value":"Tomorrow"},{"label":"This Weekend","value":"This weekend"}]-->
<wait for response>

Step 2 — Time: "What time?"
<!--actions:[{"label":"12:00 PM","value":"12:00 PM"},{"label":"6:00 PM","value":"6:00 PM"},{"label":"7:00 PM","value":"7:00 PM"},{"label":"8:00 PM","value":"8:00 PM"}]-->
<wait for response>

Step 3 — Guests: "How many people?"
<!--actions:[{"label":"2","value":"2 guests"},{"label":"3-4","value":"3-4 guests"},{"label":"5-6","value":"5-6 guests"},{"label":"7+","value":"7+ guests"}]-->
<wait for response>

Step 4 — Name: "What name for the reservation?"
<wait for response>

Step 5 — Contact: "Phone or email to confirm?"
<wait for response>

Step 6 — Confirm: Summarize and confirm.
<!--actions:[{"label":"Confirm","value":"Yes, confirm"},{"label":"Change","value":"I want to change something"}]-->
<wait for response>

Step 7: "You're all set! 🎉 See you then!"
${bookingLink ? `<!--actions:[{"label":"View Booking","value":"","url":"${bookingLink}"}]-->` : ""}`;
}

function buildGenericChatbotFlow(bookingLink: string): string {
  return `
[INQUIRY FLOW]
Trigger: User wants information or to book a service.

Step 1: "What can I help you with today?"
<!--actions:[{"label":"Our Services","value":"What services do you offer?"},{"label":"Pricing","value":"What are your prices?"},{"label":"Book Now","value":"I want to book"},{"label":"Contact Info","value":"How can I reach you?"}]-->
<wait for response>

Step 2: Answer from knowledge base. Suggest relevant services with recommendation cards.
<wait for response>

Step 3: Guide toward booking. "Would you like to schedule this?"
<!--actions:[{"label":"Yes, Book","value":"Yes, I want to book"},{"label":"More Info","value":"Tell me more first"}]-->
<wait for response>

Step 4: Collect name, contact, preferred date/time (one at a time).

Step 5: Confirm and complete.
${bookingLink ? `<!--actions:[{"label":"Book Online","value":"","url":"${bookingLink}"}]-->` : ""}`;
}

function buildSystemPrompt(chatbot: any, calendarUrl?: string, scrapedData?: any): string {
  const base = chatbot.system_prompt || "";
  const businessName = chatbot.business_name || "the business";
  const services: string[] = Array.isArray(chatbot.services) ? chatbot.services : [];
  const faqTopics: string[] = Array.isArray(chatbot.faq_topics) ? chatbot.faq_topics : [];
  const research = chatbot.research_data || {};
  const websiteUrl = chatbot.website_url || "";
  const industry = chatbot.industry || "";
  const resolvedIndustry = detectIndustry(industry);

  const detectedPages: any[] = research.detected_pages || research.pages || [];
  const menuItems: any[] = research.menu_items || [];
  const businessHours = research.business_hours || "";
  const address = research.address || "";
  const phone = research.phone || "";

  const bookingLink = calendarUrl || chatbot.widget_config?.calendarUrl || "";
  const agentName = chatbot.widget_config?.agent_name || "Emma";

  const knowledgeBase = buildKnowledgeBase(chatbot, scrapedData);

  // Build industry-specific flow
  let taskFlow = "";
  if (resolvedIndustry === "dental") {
    taskFlow = buildDentalChatbotFlow(bookingLink);
  } else if (resolvedIndustry === "restaurant") {
    taskFlow = buildRestaurantChatbotFlow(bookingLink, menuItems);
  } else {
    taskFlow = buildGenericChatbotFlow(bookingLink);
  }

  const structuredPrompt = `
[IDENTITY]
You are ${agentName}, an AI chatbot for ${businessName}.
You handle chat messages with a friendly, efficient, and professional tone.
Your job is to:
- Help users with appointment booking, questions, and basic business information
- Guide conversations naturally toward booking or the next clear step
- Use the knowledge base for accurate answers
- Escalate to a human only when necessary
Stay natural, be helpful, and ensure users feel supported.

[CORE CONTEXT (PAIN → OUTCOME → SOLUTION)]
${resolvedIndustry === "dental" ? "Missed calls = lost patients = lost revenue." : resolvedIndustry === "restaurant" ? "Slow responses = lost orders = lost revenue." : "Delayed responses = missed opportunities = lost revenue."}
Your role is to capture every opportunity and convert it into a ${resolvedIndustry === "restaurant" ? "booking or order" : "booking or clear next step"}.
Always move the conversation toward:
👉 ${resolvedIndustry === "dental" ? "Appointment booking or clear next step" : resolvedIndustry === "restaurant" ? "Order placement or table reservation" : "Service booking or clear next step"}

[STYLE GUARDRAILS]
- Be concise: keep responses short and clear (1-3 sentences max unless listing)
- Use variety: avoid sounding robotic — vary your phrasing
- Be proactive: guide the conversation, don't wait passively
- One question at a time — never overwhelm
- Ask for clarification if needed
- Do not mention errors — recover smoothly
- Stay in character at all times as ${agentName}
- Confirm important details before finalizing
- Use knowledge base — never guess or make up information
- Escalate if user is upset or asks for a human
- Use contractions (I'm, we've, you'll)
- Sound like a real person texting, NOT an AI bot
- Emojis sparingly (1-2 per message max)

[INTRO FLOW]
You are handling the start of a new chat conversation.
Your job is to greet and identify intent ONLY.

Steps:
1. Greet warmly:
"Hi there! 👋 I'm ${agentName} from ${businessName}. How can I help you today?"
<!--actions:[{"label":"${resolvedIndustry === "dental" ? "Book Appointment" : resolvedIndustry === "restaurant" ? "Order Food" : "Our Services"}","value":"${resolvedIndustry === "dental" ? "I want to book an appointment" : resolvedIndustry === "restaurant" ? "I want to order food" : "What services do you offer?"}"},{"label":"${resolvedIndustry === "restaurant" ? "Reserve Table" : "Ask a Question"}","value":"${resolvedIndustry === "restaurant" ? "I want to reserve a table" : "I have a question"}"},{"label":"${resolvedIndustry === "dental" ? "Insurance Info" : "Contact Info"}","value":"${resolvedIndustry === "dental" ? "What insurance do you accept?" : "How can I contact you?"}"}]-->
<wait for response>

2. Route based on intent:
- Booking/appointment/order → go to relevant TASK FLOW
- Question/info → go to FAQ FLOW
- Upset/human request → go to ESCALATION FLOW
⚠️ Do NOT solve here. Only identify and route.

${taskFlow}

[FAQ FLOW]
Trigger: User asks a question about services, pricing, hours, location, etc.

Rules:
- Answer using knowledge base and scraped data ONLY
- Keep answers short and clear
- If unsure, say: "Let me check on that — I'll have the team get back to you."
- After answering, always offer a next step:
<!--actions:[{"label":"${resolvedIndustry === "dental" ? "Book Appointment" : resolvedIndustry === "restaurant" ? "Place Order" : "Book Now"}","value":"${resolvedIndustry === "dental" ? "I want to book" : resolvedIndustry === "restaurant" ? "I want to order" : "I want to book"}"},{"label":"Another Question","value":"I have another question"}]-->

[ESCALATION FLOW]
Trigger: User is upset, frustrated, asks for human, or issue is complex.

Say: "I completely understand. Let me connect you with our team right away."
${phone ? `"You can also reach us directly at ${phone}."` : ""}
<!--actions:[${phone ? `{"label":"Call Us","value":"","url":"tel:${phone}"},` : ""}{"label":"Leave Message","value":"I'd like to leave a message"}]-->

[MEMORY + CONTEXT]
- Remember everything the user said in this conversation
- Do not ask again for info already provided (name, issue, preference)
- Reference previous messages naturally
- Continue smoothly across conversation turns

[STRICT RULES]
- Never guess or make up information — use KB only
- Never overwhelm with too much info at once
- Never ask multiple questions at once
- Never break character as ${agentName}
- Always move toward booking or resolution
- Never mention "AI", "system", "function", "tool", or "assistant"
- Format prices clearly
- Use markdown for readability when listing items

[INTERACTIVE RESPONSE FORMAT]
After your text response, include interactive buttons using this EXACT format:
<!--actions:[{"icon":"icon","label":"Button Text","value":"message to send"},...]-->
Always include relevant action buttons to guide the user to the next step.

[SMART RECOMMENDATIONS]
When the user asks about products, menu items, services, or anything matchable from KB, return recommendation cards using this EXACT format BEFORE the actions block:
<!--recommendations:[{"name":"Item Name","price":"$10","description":"Short desc","image_url":"https://...","category":"Category","actions":[{"label":"${resolvedIndustry === "dental" ? "Book This" : resolvedIndustry === "restaurant" ? "Order" : "Select"}","value":"I want Item Name"}]}]-->

Recommendation rules:
- Show 2-4 most relevant items
- Include image_url when available
- Personalize based on user's stated needs
- Always include at least one action button per recommendation

[KNOWLEDGE BASE — SCRAPED DATA]
Always prioritize scraped website content over assumptions.
Answer using only verified data from the knowledge base.
Keep answers: short, clear, relevant.
If data is missing, say: "I don't have that info right now, but I can have the team follow up."

[BUSINESS INFORMATION]
${address ? `📍 Address: ${address}` : ""}
${phone ? `📞 Phone: ${phone}` : ""}
${businessHours ? `🕐 Hours: ${businessHours}` : ""}
${websiteUrl ? `🌐 Website: ${websiteUrl}` : ""}
${detectedPages.length > 0 ? `\nPages:\n${detectedPages.map((p: any) => `- ${p.title || p.name}: ${p.url}`).join("\n")}` : ""}
${services.length > 0 ? `\nServices: ${services.join(", ")}` : ""}
${faqTopics.length > 0 ? `\nCommon questions: ${faqTopics.join(", ")}` : ""}
${industry ? `\nIndustry: ${industry}` : ""}
${knowledgeBase}
`;

  return base + structuredPrompt;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = supabaseClient;

  try {
    const { chatbotId, sessionId, message, calendarUrl } = await req.json();

    if (!chatbotId || !sessionId || !message) {
      return new Response(
        JSON.stringify({ error: "chatbotId, sessionId, and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Parallel fetch: chatbot + conversation in one go ──
    const [chatbotResult, conversationResult] = await Promise.all([
      supabase.from("chatbots").select("*").eq("id", chatbotId).single(),
      supabase.from("chatbot_conversations").select("*").eq("chatbot_id", chatbotId).eq("session_id", sessionId).maybeSingle(),
    ]);

    const { data: chatbot, error: chatbotError } = chatbotResult;
    if (chatbotError || !chatbot) {
      return new Response(
        JSON.stringify({ error: "Chatbot not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const conversation = conversationResult.data;
    const existingMessages = (conversation?.messages as any[]) || [];
    const updatedMessages = [
      ...existingMessages,
      { role: "user", content: message, timestamp: new Date().toISOString() },
    ];

    // Fetch scraped data + providers in parallel
    const [scrapedResult, providers] = await Promise.all([
      chatbot.website_url
        ? supabase.from("scraped_data").select("structured_data, raw_content").eq("website_url", chatbot.website_url).maybeSingle()
        : Promise.resolve({ data: null }),
      getProviders(supabase, chatbot),
    ]);
    const scrapedData = scrapedResult.data;

    const systemPrompt = buildSystemPrompt(chatbot, calendarUrl, scrapedData);

    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...updatedMessages.map((m: any) => ({ role: m.role, content: m.content })),
    ];

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

        // Calculate conversation quality score (0-100)
        const userMsgs = finalMessages.filter((m: any) => m.role === "user");
        const assistantMsgs = finalMessages.filter((m: any) => m.role === "assistant");
        let score = 0;
        // Message count depth (max 30 pts)
        score += Math.min(userMsgs.length * 10, 30);
        // Avg message length (max 20 pts)
        const avgUserLen = userMsgs.length > 0 ? userMsgs.reduce((s: number, m: any) => s + (m.content?.length || 0), 0) / userMsgs.length : 0;
        score += Math.min(Math.round(avgUserLen / 5), 20);
        // Back-and-forth ratio (max 20 pts)
        if (assistantMsgs.length > 0 && userMsgs.length > 0) {
          const ratio = Math.min(userMsgs.length / assistantMsgs.length, 1);
          score += Math.round(ratio * 20);
        }
        // Intent signals (max 30 pts)
        const allUserText = userMsgs.map((m: any) => (m.content || "").toLowerCase()).join(" ");
        const intentKeywords = ["order", "book", "reserve", "buy", "price", "cost", "appointment", "schedule", "menu", "service", "deliver", "pickup", "available", "open", "hours", "address", "phone", "contact"];
        const matchedIntents = intentKeywords.filter(k => allUserText.includes(k));
        score += Math.min(matchedIntents.length * 6, 30);

        const conversationScore = Math.min(score, 100);

        // Save conversation with score
        const saveData = {
          messages: finalMessages,
          updated_at: new Date().toISOString(),
        };

        if (conversation) {
          await supabase
            .from("chatbot_conversations")
            .update(saveData)
            .eq("id", conversation.id);
        } else {
          await supabase.from("chatbot_conversations").insert({
            chatbot_id: chatbotId,
            session_id: sessionId,
            ...saveData,
          });
        }

        // Track conversation quality as an event
        if (conversationScore > 0) {
          try {
            await supabase.from("link_events").insert({
              slug: chatbot?.slug || "unknown",
              event_type: "chatbot_message",
              business_name: chatbot?.business_name || "unknown",
              session_id: sessionId,
              chatbot_id: chatbotId,
              metadata: {
                conversation_score: conversationScore,
                message_count: userMsgs.length,
                intent_signals: matchedIntents,
                avg_msg_length: Math.round(avgUserLen),
              },
            });
          } catch { /* non-critical */ }
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
