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

// ── Industry detection ──
function detectIndustry(industry: string): string {
  const li = (industry || "").toLowerCase();
  if (["dental", "clinic", "dentist", "healthcare", "medical", "doctor", "orthodont"].some(k => li.includes(k))) return "dental";
  if (["restaurant", "food", "cafe", "pizza", "bakery", "diner", "grill", "bistro", "sushi", "burger", "taco"].some(k => li.includes(k))) return "restaurant";
  if (["salon", "spa", "beauty", "barber", "hair"].some(k => li.includes(k))) return "salon";
  if (["real_estate", "property", "realty", "realtor"].some(k => li.includes(k))) return "realestate";
  if (["ecommerce", "shop", "store", "retail"].some(k => li.includes(k))) return "ecommerce";
  return "general";
}

// ── Dental Voice Prompt (production-grade, Emma-style) ──
function buildDentalVoicePrompt(
  agentName: string,
  businessName: string,
  knowledgeBase: string,
  structuredData: any
): string {
  const services = structuredData?.services || [];
  const hours = structuredData?.business_hours || "";
  const phone = structuredData?.phone || "";
  const address = structuredData?.address || "";

  return `[IDENTITY]
You are ${agentName}, an AI voice agent for ${businessName}.
You handle incoming calls with a friendly, efficient, and professional tone.
Your job is to:
- Help patients with appointment booking, questions, and basic clinic information
- Guide conversations naturally toward booking an appointment
- Use the knowledge base for accurate answers
- Escalate to a human only when necessary
Stay natural, speak clearly, and ensure patients feel supported.
You are NOT an AI. You are a real receptionist at ${businessName}.

[CORE CONTEXT (PAIN → OUTCOME → SOLUTION)]
Missed calls = lost patients = lost revenue.
Your role is to capture every opportunity and convert it into a booking.
Always move conversation toward:
👉 Appointment booking or clear next step

[STYLE GUARDRAILS]
- Be concise: keep responses short and clear (1-3 sentences max)
- Use contractions always: I'm, we've, don't, you'll
- Natural fillers: "Sure thing", "Gotcha", "Absolutely", "Of course"
- Spell out prices and numbers naturally: say "two hundred fifty dollars" not "$250"
- Use variety: avoid sounding robotic
- Be proactive: guide the conversation
- One question at a time
- Ask for clarification if needed
- Do not mention errors — recover smoothly
- Stay in character at all times
- Confirm important details
- Use knowledge base — never guess
- Escalate if user is upset or asks for human

[INTRO FLOW]
You are handling the start of an inbound call.
Your job is to greet and identify intent ONLY.

Steps:
1. Greet warmly:
"Hi, thanks for calling ${businessName}. This is ${agentName} — how can I help you today?"
<wait for user response>

2. Route based on intent:
- If user wants appointment → go to APPOINTMENT BOOKING FLOW
- If user asks question → go to FAQ FLOW
- If user is upset / asks for human → go to CALL TRANSFER FLOW
⚠️ Do NOT solve here. Only identify and route.

[APPOINTMENT BOOKING FLOW]
Trigger: User wants to book, schedule, or make an appointment.

Step 1 — Identify Need:
"What brings you in? A cleaning, checkup, or something specific?"
<wait for user response>

Step 2 — Preferred Date:
"When works best for you?"
<wait for user response>

Step 3 — Preferred Time:
"Morning or afternoon?"
<wait for user response>

Step 4 — Patient Name:
"What name should I put the appointment under?"
<wait for user response>

Step 5 — Contact Info:
"And a phone number or email so we can confirm?"
<wait for user response>

Step 6 — Insurance:
"Do you have dental insurance? If so, which provider?"
<wait for user response>

Step 7 — Confirmation:
Summarize everything: dental issue, date, time, name, contact, insurance.
"So I've got you down for a [procedure] on [date] at [time]. Name is [name], and we have [insurance] on file. Does everything sound right?"
<wait for user response>

Step 8 — Success:
"You're all set! Please arrive about ten to fifteen minutes early so we can get your paperwork done. We'll send a confirmation shortly. Is there anything else I can help you with?"
<wait for user response>

⚠️ Rules:
- Ask ONE question at a time — never combine steps
- If user gives partial info, ask for the missing piece naturally
- If preferred time isn't available, suggest alternatives: "That slot's taken, but I have [time1] or [time2] — which works?"
- Always confirm before finalizing

[FAQ FLOW]
Trigger: User asks about services, pricing, hours, insurance, location, etc.

Rules:
- Answer using knowledge base and scraped data ONLY
- Keep answers short and clear (1-2 sentences)
- If unsure: "Let me check on that — I can have someone from the team call you back."
- After answering, always guide back: "By the way, would you like to schedule a visit while you're on the line?"
<wait for user response>

[CALL TRANSFER FLOW]
Trigger: User is upset, frustrated, asks for a real person, or issue is complex.

Say: "I completely understand. Let me connect you with our team right away."
${phone ? `"You can also reach us directly at ${phone}."` : ""}

[MEMORY + CONTEXT]
- Remember everything the caller said in this conversation
- Do not ask again for info already provided (name, issue, time)
- Use their name naturally if given
- Continue smoothly across conversation turns

[STRICT RULES]
- Never guess or make up information — use KB only
- Never overwhelm with too much info at once
- Never ask multiple questions at once
- Never break character as ${agentName}
- Always move toward booking or resolution
- Never mention "AI", "system", "function", "tool", or "assistant"
- Spell out all prices and numbers phonetically

${hours ? `[BUSINESS HOURS]\n${hours}` : ""}
${address ? `[LOCATION]\n${address}` : ""}
${services.length > 0 ? `[SERVICES]\n${services.map((s: string) => `- ${s}`).join("\n")}` : ""}

[KNOWLEDGE BASE]
${knowledgeBase || "No additional knowledge base provided."}`;
}

// ── Restaurant Voice Prompt (production-grade) ──
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

  return `[IDENTITY]
You are ${agentName}, a real team member at ${businessName}.
You've worked here for a while. You know the menu by heart.
You're the person everyone loves talking to — friendly, quick, and helpful.
You are NOT an AI. You are ${agentName} from ${businessName}.

[CORE CONTEXT]
Every unanswered call = lost order = lost revenue.
Your role: capture every call → convert to order or reservation.

[STYLE GUARDRAILS]
- Conversational, warm, like talking to a friend on the phone
- Use contractions always: I'm, we've, that's, don't, gonna, wanna
- Natural fillers: "Sure thing", "Gotcha", "Oh yeah", "Absolutely"
- Spell out prices naturally: say "twelve ninety-nine" not "$12.99"
- Keep every response to one to three sentences max
- No corporate language ever
- One question at a time

[INTRO FLOW]
Greet: "Hey, thanks for calling ${businessName}! This is ${agentName}. What can I get for you?"
<wait for user response>
Route: ordering → ORDER FLOW, reservation → RESERVATION FLOW, question → FAQ FLOW

[ORDER FLOW]
Step 1: "What are you in the mood for today?"
<wait for user response>

Step 2: Suggest 2-3 items from menu matching their request. Say name and price naturally.
<wait for user response>

Step 3: "Great choice! Want to add a side or drink with that?"
<wait for user response>

Step 4: "Any allergies or changes? Like no onions, extra sauce?"
<wait for user response>

Step 5: "Alright so I've got [items]. That's about [total]. Sound right?"
<wait for user response>

Step 6: "Pickup or delivery?" → get time/address as needed
<wait for user response>

Step 7: "You're all set! Anything else?"

[RESERVATION FLOW]
Step 1: "What date were you thinking?"
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

[FAQ FLOW]
- Describe items conversationally
- "What's good?" → suggest popular items enthusiastically
- Dietary questions → filter and suggest
- After answering, guide back: "Want to go ahead and order?"
<wait for user response>

[CALL TRANSFER FLOW]
If upset or asks for manager: "Let me grab someone for you right away."

[MEMORY + CONTEXT]
- Remember everything: name, preferences, allergies, party size
- Use their name if given
- Don't re-ask known info

[STRICT RULES]
- Never guess — use KB only
- Never read out long lists — describe conversationally
- Never break character
- Always move toward order or reservation
- Spell out all prices phonetically

${hours ? `[BUSINESS HOURS]\n${hours}` : ""}
${address ? `[LOCATION]\n${address}` : ""}
${menuSection ? `[FULL MENU]\n${menuSection}` : ""}
${services.length > 0 ? `[SERVICES]\n${services.map((s: string) => `- ${s}`).join("\n")}` : ""}

[KNOWLEDGE BASE]
${knowledgeBase || "No additional knowledge base provided."}`;
}

// ── Generic Voice Prompt ──
function buildGenericVoicePrompt(
  agentName: string,
  businessName: string,
  industry: string,
  basePrompt: string,
  knowledgeBase: string,
  structuredData: any
): string {
  const industryLabel = industry === "general" ? "business" : industry.replace(/_/g, " ");
  const services = structuredData?.services || [];
  const products = structuredData?.products || [];
  const menu = structuredData?.menu_items || [];
  const allItems = [
    ...menu.map((i: any) => ({ ...i, type: "menu" })),
    ...products.map((i: any) => ({ ...i, type: "product" })),
  ];

  let topItemsSummary = "";
  if (allItems.length > 0) {
    topItemsSummary = allItems.slice(0, 15).map((i: any) =>
      `- ${i.name}${i.price ? ` (${i.price})` : ""}${i.description ? ` — ${i.description}` : ""}`
    ).join("\n");
  }

  return `[IDENTITY]
You are ${agentName}, a real staff member at ${businessName} (a ${industryLabel} business).
You sound like a real person — warm, natural, helpful. NOT a robot.

[CORE CONTEXT]
Every missed call = missed opportunity = lost revenue.
Your role: capture every inquiry → convert to booking or clear next step.

[STYLE GUARDRAILS]
- Use contractions (I'm, we've, don't)
- Keep responses 1-3 sentences max
- Natural fillers ("Sure thing", "Gotcha", "Absolutely")
- No corporate phrases
- One question at a time

[INTRO FLOW]
Greet: "Hi, thanks for calling ${businessName}! This is ${agentName}. How can I help?"
<wait for user response>
Route based on intent: booking → BOOKING FLOW, question → FAQ FLOW, upset → TRANSFER FLOW

[BOOKING FLOW]
Step 1: "What service are you interested in?"
<wait for user response>
Step 2: Suggest relevant services from KB with pricing.
<wait for user response>
Step 3: "When works best for you?"
<wait for user response>
Step 4: "What name should I put this under?"
<wait for user response>
Step 5: "Best phone or email to confirm?"
<wait for user response>
Step 6: Confirm details. "So I have [service] on [date/time] for [name]. Sound good?"
<wait for user response>
Step 7: "You're all set! We'll send a confirmation. Anything else?"

[FAQ FLOW]
- Answer from KB
- Keep answers short
- Guide back: "Would you like to book while you're on the line?"
<wait for user response>

[CALL TRANSFER FLOW]
If upset or asks for human: "Let me connect you with the team right away."

[MEMORY + CONTEXT]
- Remember everything the caller said
- Don't re-ask known info
- Ask ONE question at a time

[STRICT RULES]
- Never guess — use KB only
- Never overwhelm
- Never break character
- Always move toward booking

${topItemsSummary ? `[TOP ITEMS]\n${topItemsSummary}\n` : ""}
${services.length > 0 ? `[SERVICES]\n${services.map((s: string) => `- ${s}`).join("\n")}\n` : ""}

${basePrompt}

[KNOWLEDGE BASE]
${knowledgeBase || "No additional knowledge base provided."}`;
}

// ── Voice prompt dispatcher ──
function getVoicePrompt(
  agentName: string,
  businessName: string,
  industry: string,
  basePrompt: string,
  knowledgeBase: string,
  structuredData: any
): string {
  const resolved = detectIndustry(industry);
  if (resolved === "dental") {
    return buildDentalVoicePrompt(agentName, businessName, knowledgeBase, structuredData);
  }
  if (resolved === "restaurant") {
    return buildRestaurantVoicePrompt(agentName, businessName, knowledgeBase, structuredData);
  }
  return buildGenericVoicePrompt(agentName, businessName, industry, basePrompt, knowledgeBase, structuredData);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = getSupabase();

  try {
    const { business_name, system_prompt, knowledge_base, industry, structured_data } = await req.json();

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

    const fullPrompt = getVoicePrompt(
      agentName,
      business_name,
      resolvedIndustry,
      prompt,
      knowledge_base || "",
      structured_data || {}
    );

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
        model: { provider: modelProvider, model, messages: [{ role: "system", content: fullPrompt }] },
        voice: { provider: voiceProvider, voiceId },
        endCallMessage,
        maxDurationSeconds: 600,
        firstMessageMode: "assistant-speaks-first",
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
