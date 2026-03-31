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

// ── Build advanced voice agent prompt (same logic as create-demo) ──
function buildVoiceAgentPrompt(
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

  // Industry-specific flows
  let industryFlows = "";
  const li = industry.toLowerCase();
  if (li.includes("restaurant") || li.includes("food") || li.includes("cafe") || li.includes("pizza")) {
    industryFlows = `\n## ORDERING FLOW\n1. Ask what they're in the mood for\n2. Suggest 2-3 menu items\n3. Ask dietary needs, spice level\n4. Suggest combos/add-ons\n5. Confirm order + pickup/delivery\n\n## RESERVATION FLOW\n1. Date, time, party size\n2. Get name + contact\n3. Confirm details`;
  } else if (li.includes("ecommerce") || li.includes("shop") || li.includes("store") || li.includes("retail")) {
    industryFlows = `\n## PRODUCT HELP FLOW\n1. Ask what they're looking for\n2. Suggest 2-3 matching products with prices\n3. Help with sizing, shipping questions\n4. Guide to purchase`;
  } else if (li.includes("clinic") || li.includes("dental") || li.includes("medical") || li.includes("doctor")) {
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
You sound like a real person on the phone — warm, natural, and helpful. NOT a robot.

## VOICE & TONE
- Use contractions (I'm, we've, don't)
- Keep responses 1-3 sentences max
- Sound genuinely interested, not scripted
- Use natural fillers ("Sure thing", "Gotcha", "Absolutely")
- No corporate phrases, no bullet points — speak naturally

## SMART RECOMMENDATIONS
When the caller asks about ${menu.length > 0 ? "menu items" : products.length > 0 ? "products" : "services"}:
- Suggest 2-3 best matches from your knowledge base
- Include name, price, brief description
- Ask: "Want me to add that?" or "Sound good?"
- If no match: "Hmm, we do have [alternative]. Would that work?"

${topItemsSummary ? `## TOP ITEMS\n${topItemsSummary}\n` : ""}
${services.length > 0 ? `## SERVICES\n${services.map((s: string) => `- ${s}`).join("\n")}\n` : ""}
${industryFlows}

## MULTI-TURN CONTEXT
- Remember everything the caller said
- Don't repeat questions — build on previous answers
- Ask ONE question at a time

## FALLBACK
- Don't know? "Let me check... I can have someone get back to you."
- Never make up info
- If confused: "Sorry, could you say that again?"

${basePrompt}

${knowledgeBase ? `## Knowledge Base\n${knowledgeBase}` : ""}`;
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

    const fullPrompt = buildVoiceAgentPrompt(
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
