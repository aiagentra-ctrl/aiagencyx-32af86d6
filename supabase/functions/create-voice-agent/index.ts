import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getSupabase() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function loadAdminSettings(supabase: any): Promise<Record<string, string>> {
  const { data } = await supabase.from("site_settings").select("key, value");
  const map: Record<string, string> = {};
  if (data) for (const row of data) { map[row.key] = row.value || ""; }
  return map;
}

function injectVars(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); } finally { clearTimeout(timer); }
}

// ── Restaurant-specific VAPI prompt (production-grade) ──
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
- Use contractions always: I'm, we've, that's, don't, gonna, wanna
- Natural fillers: "Sure thing", "Gotcha", "Oh yeah", "Absolutely", "For sure"
- Spell out prices naturally: say "twelve ninety-nine" not "$12.99"
- Keep every response to one to three sentences max
- No corporate language ever
- Add natural pauses: "Let me think..." "Hmm..."

[Response Guidelines]
- Ask ONE question at a time
- Remember everything: name, preferences, allergies, party size
- Use their name naturally if they give it
- Confirm before finalizing any order or reservation
- Never say "function", "tool", "API", "system", "AI", or "assistant"
- Never read out lists — describe items conversationally

[Task: Taking Orders]
Step 1: "What are you in the mood for today?"
<wait for user response>

Step 2: Suggest two to three items from menu based on their answer.
- Say name and price naturally: "We've got the chicken parmesan, about fourteen ninety-nine, really popular"
- Filter by preference if mentioned (spicy, vegetarian, budget)
<wait for user response>

Step 3: "Great choice! Want to add [side or drink] with that?"
<wait for user response>

Step 4: "Any allergies or changes? Like no onions, extra sauce?"
<wait for user response>

Step 5: "Alright so I've got [items]. That's about [total]. Sound right?"
<wait for user response>

Step 6: "Pickup or delivery?" → get time/address as needed

Step 7: "You're all set! Anything else?"

[Task: Table Reservations]
Step 1: "Sure! What date were you thinking?"
<wait for user response>
Step 2: "And what time?"
<wait for user response>
Step 3: "How many people?"
<wait for user response>
Step 4: "Name for the reservation?"
<wait for user response>
Step 5: "Phone number just in case?"
<wait for user response>
Step 6: "Got it — [name], party of [size], [date] at [time]. See you then!"

[Task: Menu Questions]
- Describe items conversationally with appetite appeal
- "What's good?" → suggest popular items enthusiastically
- Dietary questions → filter and suggest

[Task: Natural Upselling]
- Casually suggest sides/drinks after main item
- Mention combos if they save money
- Never be pushy — mention once, move on if declined

${hours ? `[Business Hours]\n${hours}` : ""}
${address ? `[Location]\n${address}` : ""}
${menuSection ? `[Full Menu]\n${menuSection}` : ""}
${services.length > 0 ? `[Services]\n${services.map((s: string) => `- ${s}`).join("\n")}` : ""}

[Error Handling]
- Missed what they said: "Sorry, could you say that one more time?"
- Not on menu: "Hmm, I don't think we have that... but we do have [similar]. Wanna try that?"
- Can't help: "Let me have someone get back to you — what's a good number?"
- Off-topic: "Ha, good one! Anyway, what can I get for you?"

[Knowledge Base]
${knowledgeBase || "No additional knowledge base provided."}`;
}

// ── Generic voice agent prompt (non-restaurant) ──
function buildGenericVoicePrompt(
  agentName: string,
  businessName: string,
  industry: string,
  basePrompt: string,
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
    industryFlows = `\n## PRODUCT HELP FLOW\n1. Ask what they're looking for\n2. Suggest 2-3 products with prices\n3. Help with sizing, shipping\n4. Guide to purchase`;
  } else if (li.includes("clinic") || li.includes("dental") || li.includes("medical") || li.includes("doctor")) {
    industryFlows = `\n## APPOINTMENT BOOKING\n1. Ask what service\n2. Suggest services\n3. Ask date/time\n4. Collect name + phone\n5. Confirm`;
  } else if (li.includes("salon") || li.includes("spa") || li.includes("beauty") || li.includes("barber")) {
    industryFlows = `\n## BOOKING FLOW\n1. Ask service type\n2. Suggest + pricing\n3. Book date/time\n4. Confirm`;
  } else if (li.includes("real_estate") || li.includes("property") || li.includes("realty")) {
    industryFlows = `\n## PROPERTY INQUIRY\n1. Buy/rent?\n2. Location + budget\n3. Suggest listings\n4. Schedule viewing`;
  } else if (li.includes("law") || li.includes("legal") || li.includes("attorney")) {
    industryFlows = `\n## CONSULTATION FLOW\n1. Legal matter type\n2. Explain areas\n3. Schedule consultation`;
  } else if (li.includes("gym") || li.includes("fitness")) {
    industryFlows = `\n## MEMBERSHIP FLOW\n1. Ask fitness goals\n2. Suggest plans\n3. Offer trial\n4. Sign-up`;
  } else {
    industryFlows = `\n## GENERAL INQUIRY\n1. Understand needs\n2. Suggest from KB\n3. Answer pricing/hours\n4. Offer to book\n5. Collect contact`;
  }

  return `## ROLE & IDENTITY
You are ${agentName}, a real staff member at ${businessName} (a ${industryLabel} business).
You sound like a real person — warm, natural, helpful. NOT a robot.

## VOICE & TONE
- Use contractions (I'm, we've, don't)
- Keep responses 1-3 sentences max
- Natural fillers ("Sure thing", "Gotcha", "Absolutely")
- No corporate phrases

## SMART RECOMMENDATIONS
When the caller asks about ${products.length > 0 ? "products" : "services"}:
- Suggest 2-3 best matches from KB
- Present: name, price, description
- Ask: "Sound good?" or "Want me to set that up?"

${topItemsSummary ? `## TOP ITEMS\n${topItemsSummary}\n` : ""}
${services.length > 0 ? `## SERVICES\n${services.map((s: string) => `- ${s}`).join("\n")}\n` : ""}
${industryFlows}

## MULTI-TURN CONTEXT
- Remember everything the caller said
- Ask ONE question at a time
- Don't repeat questions

## FALLBACK
- Don't know? "Let me check... I can have someone get back to you."
- Never make up info
- If confused: "Sorry, could you say that again?"

${basePrompt}

${knowledgeBase ? `## Knowledge Base\n${knowledgeBase}` : ""}`;
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

[Style]
- Warm, reassuring, professional — patients may be anxious or in pain
- Use contractions always: I'm, we've, that's, don't, we'll, you'll
- Natural fillers: "Sure thing", "Absolutely", "Of course", "No problem at all"
- Spell out prices naturally: say "two hundred fifty" not "$250"
- Keep every response to one to three sentences max
- Reassuring phrases: "We'll take great care of you", "Don't worry, we see this all the time"

[Response Guidelines]
- Ask ONE question at a time
- Remember everything: name, concern, insurance, preferred times
- Use their name naturally
- Confirm before finalizing any appointment
- Never say "function", "tool", "API", "system", "AI", or "assistant"
- Never guess treatments, pricing, or insurance coverage

[Task: Appointment Booking]
Step 1: "What brings you in? Routine cleaning, a specific concern, or something else?"
<wait for user response>
Step 2: Suggest relevant services from KB with pricing if available.
<wait for user response>
Step 3: "Do you have a preferred day?"
<wait for user response>
Step 4: "Morning or afternoon?"
<wait for user response>
Step 5: "Can I get your name?"
<wait for user response>
Step 6: "Best phone number to reach you?"
<wait for user response>
Step 7: "Do you have dental insurance? If so, which provider?"
<wait for user response>
Step 8: Confirm: "So I've got [service] on [date], [time] for [name]. Sound good?"
<wait for user response>
Step 9: "You're all set! We'll send a confirmation."

[Task: Emergency Handling]
URGENT KEYWORDS: pain, emergency, broken, cracked, knocked out, bleeding, swelling, abscess
- Immediately: "Let's get you in as soon as possible."
- Fast-track booking — skip non-essential questions
- Reassure: "We see this all the time — you'll be in good hands"

[Task: Service Questions]
- Pull from KB ONLY — never guess
- Describe simply, guide toward booking
- If not in KB: "Let me have our team confirm that for you"

[Task: Insurance & Pricing]
- Share KB data if available
- Otherwise: "I can have our billing team check — what's the best number?"

[KB Usage Rules — STRICT]
- ONLY answer from verified knowledge base data
- NEVER guess services, treatments, or pricing
- NEVER mention "scraped data", "database", or "Firecrawl"
- If missing: "Let me have someone confirm that and get back to you"

${hours ? `[Business Hours]\n${hours}` : ""}
${address ? `[Location]\n${address}` : ""}
${phone ? `[Phone]\n${phone}` : ""}
${servicesSection ? `[Services & Treatments]\n${servicesSection}` : ""}

[Error Handling]
- Didn't catch: "Sorry, could you say that one more time?"
- Not offered: "We don't offer that specifically, but we do have [alternative]"
- Can't answer: "Let me have our team get back to you on that"
- Nervous caller: "I totally understand — our team is really gentle, I promise"

[Knowledge Base]
${knowledgeBase}`;
}

// ── Voice prompt dispatcher ──
function isRestaurantIndustry(industry: string): boolean {
  const li = industry.toLowerCase();
  return ["restaurant", "food", "cafe", "pizza", "bakery", "diner", "grill", "bistro", "sushi", "burger", "taco"]
    .some(k => li.includes(k));
}

function isDentalIndustry(industry: string): boolean {
  const li = industry.toLowerCase();
  return ["dental", "dentist", "clinic", "orthodont", "oral", "healthcare", "medical", "doctor", "health"]
    .some(k => li.includes(k));
}

function getVoicePrompt(
  agentName: string,
  businessName: string,
  industry: string,
  basePrompt: string,
  knowledgeBase: string,
  structuredData: any
): string {
  if (isRestaurantIndustry(industry)) {
    return buildRestaurantVoicePrompt(agentName, businessName, knowledgeBase, structuredData);
  }
  if (isDentalIndustry(industry)) {
    return buildDentalVoicePrompt(agentName, businessName, knowledgeBase, structuredData);
  }
  return buildGenericVoicePrompt(agentName, businessName, industry, basePrompt, knowledgeBase, structuredData);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = getSupabase();

  try {
    const { business_name, system_prompt, knowledge_base, industry, structured_data, chatbot_id } = await req.json();

    if (!business_name) {
      return new Response(JSON.stringify({ error: "business_name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminSettings = await loadAdminSettings(supabase);
    const vapiKey = adminSettings.vapi_private_key || Deno.env.get("VAPI_API_KEY");
    if (!vapiKey) {
      return new Response(JSON.stringify({ error: "VAPI private key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const agentName = adminSettings.default_agent_name || "Alex";
    const resolvedIndustry = industry || "general";
    const templateVars = { business_name, agent_name: agentName, industry: resolvedIndustry };

    const defaultPrompt = `You are ${agentName}, a friendly staff member at ${business_name}. You talk like a real person on the phone — warm, natural, and helpful. Keep responses short and clear.`;

    const prompt = system_prompt || injectVars(
      adminSettings.default_system_prompt || defaultPrompt,
      templateVars
    );

    const basePrompt = getVoicePrompt(
      agentName,
      business_name,
      resolvedIndustry,
      prompt,
      knowledge_base || "",
      structured_data || {}
    );

    // Load architected core facts + voice KB from chatbots row (if available)
    let coreFactsBlock = "";
    let voiceKbBlock = "";
    if (chatbot_id) {
      const { data: cb } = await supabase
        .from("chatbots")
        .select("prompt_core, kb_voice_text")
        .eq("id", chatbot_id)
        .maybeSingle();
      if (cb?.prompt_core) {
        try {
          coreFactsBlock = `\n\n## CORE FACTS — answer these instantly, no KB lookup needed\n${JSON.stringify(cb.prompt_core, null, 2)}\n`;
        } catch { /* noop */ }
      }
      if (cb?.kb_voice_text) {
        voiceKbBlock = `\n\n## VOICE KB (spoken-language reference for deeper questions)\n${cb.kb_voice_text}\n`;
      }
    }

    // RAG tool rules — always inject so voice agent uses search_knowledge_base first
    const ragRules = chatbot_id ? `

## RAG TOOL — STRICT RULES
You have a tool called \`search_knowledge_base(query)\`.
- The CORE FACTS section above already covers greetings, basic services, pricing structure,
  common objections, hours, and escalation. Answer those INSTANTLY without calling the tool.
- ONLY call search_knowledge_base when the caller asks something not covered in CORE FACTS or VOICE KB
  (specific edge cases, deep FAQs, policy specifics, individual properties or products).
- Speak ONLY from CORE FACTS, VOICE KB, or the tool's returned text. Never invent facts.
- If the tool returns "Let me check with our team on that." or empty results,
  say exactly: "Let me check with our team on that."
- The chatbot_id for this assistant is: ${chatbot_id}
` : "";

    const fullPrompt = basePrompt + coreFactsBlock + voiceKbBlock + ragRules;

    // Vapi tool definition for KB search
    const kbTool = chatbot_id ? {
      type: "function",
      async: false,
      function: {
        name: "search_knowledge_base",
        description: "Search the business knowledge base for facts, services, pricing, properties, hours, or any specific information. ALWAYS call this before answering factual questions.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "The user's question or search query" },
            top_k: { type: "number", description: "Number of results", default: 5 },
            chatbotId: { type: "string", description: "Knowledge base scope id", default: chatbot_id },
          },
          required: ["query"],
        },
      },
      server: {
        url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/search-knowledge-base`,
      },
    } : null;

    // E-commerce product recommendation tool
    const isEcommerce = (resolvedIndustry || "").toLowerCase().includes("ecommerce")
      || (resolvedIndustry || "").toLowerCase().includes("shop")
      || (resolvedIndustry || "").toLowerCase().includes("store")
      || (resolvedIndustry || "").toLowerCase().includes("retail");

    const productTool = (chatbot_id && isEcommerce) ? {
      type: "function",
      async: false,
      function: {
        name: "recommend_products",
        description: "Search the store catalog and recommend products by name, category, use case, or description. ALWAYS call this when the caller asks about products, what to buy, looking for something, or wants a recommendation.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "What the customer is looking for" },
            top_k: { type: "number", description: "Number of products to return", default: 3 },
            chatbotId: { type: "string", description: "Store id", default: chatbot_id },
          },
          required: ["query"],
        },
      },
      server: {
        url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/recommend-products`,
      },
    } : null;

    const tools = [kbTool, productTool].filter(Boolean);

    const firstMessage = injectVars(
      adminSettings.default_first_message || "Hey, this is {agent_name} from {business_name}. How can I help you today?",
      templateVars
    );
    const endCallMessage = injectVars(
      adminSettings.default_end_call_message || "Thanks for calling {business_name}! Have a great one. 👋",
      templateVars
    );

    const voiceProvider = adminSettings.voice_provider || "azure";
    const voiceId = adminSettings.voice_id || "andrew";
    const modelProvider = adminSettings.ai_model_provider || "openai";
    const model = adminSettings.ai_model || "gpt-4o";

    const res = await fetchWithTimeout("https://api.vapi.ai/assistant", {
      method: "POST",
      headers: { Authorization: `Bearer ${vapiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: business_name.substring(0, 40),
        firstMessage,
        model: {
          provider: modelProvider,
          model,
          messages: [{ role: "system", content: fullPrompt }],
          maxTokens: 150,
          temperature: 0.7,
          ...(tools.length > 0 ? { tools } : {}),
        },
        ...(chatbot_id ? { metadata: { chatbot_id } } : {}),
        voice: {
          provider: voiceProvider,
          voiceId,
          speed: 1.1,
        },
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

    if (!res.ok) {
      const err = await res.text();
      return new Response(JSON.stringify({ error: `VAPI error: ${err}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await res.json();

    return new Response(JSON.stringify({
      assistant_id: data.id,
      vapi_public_key: adminSettings.vapi_public_key || "",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
