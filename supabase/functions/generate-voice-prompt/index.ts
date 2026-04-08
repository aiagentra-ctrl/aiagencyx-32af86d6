import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function injectVars(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 60000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); } finally { clearTimeout(timer); }
}

function buildProviderList(llmProviders: any[]): { name: string; url: string; key: string; model: string }[] {
  const providers: { name: string; url: string; key: string; model: string }[] = [];
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) providers.push({ name: "Lovable AI", url: "https://ai.gateway.lovable.dev/v1/chat/completions", key: lovableKey, model: "google/gemini-3-flash-preview" });
  if (llmProviders) for (const p of llmProviders) {
    let url = p.endpoint_url;
    if (!url) {
      if (p.provider_type === "openai") url = "https://api.openai.com/v1/chat/completions";
      else if (p.provider_type === "openrouter") url = "https://openrouter.ai/api/v1/chat/completions";
      else continue;
    }
    providers.push({ name: p.name, url, key: p.api_key, model: p.model || "gpt-4" });
  }
  return providers;
}

// ── VAPI Meta-Prompt for generating industry prompts (structured format) ──
const VAPI_META_PROMPT = `You are an expert voice agent prompt engineer specializing in the VAPI platform.
Generate a production-grade voice agent system prompt that follows this EXACT structured format:

[IDENTITY]
Agent persona as {agent_name} at {business_name}. They are a real staff member, NOT an AI.
Include personality traits. State their role clearly.
"Your job is to: [primary tasks]. Guide toward [main conversion goal]. Use KB for accuracy. Escalate when necessary."

[CORE CONTEXT (PAIN → OUTCOME → SOLUTION)]
One line connecting the business pain to the agent's purpose.
Example: "Missed calls = lost patients = lost revenue. Capture every opportunity → convert to booking."

[STYLE GUARDRAILS]
- Be concise: 1-3 sentences max
- Use contractions always (I'm, we've, don't)
- Natural fillers ("Sure thing", "Gotcha", "Absolutely")
- Spell out prices/numbers naturally (say "twelve ninety-nine" not "$12.99")
- One question at a time
- No corporate language
- Confirm important details
- Use knowledge base — never guess
- Escalate if user is upset or asks for human

[INTRO FLOW]
Greet warmly with one natural sentence introducing the agent.
<wait for user response>
Route based on intent:
- If booking/ordering → go to PRIMARY TASK FLOW
- If question → go to FAQ FLOW
- If upset/human → go to CALL TRANSFER FLOW
⚠️ Do NOT solve here. Only identify and route.

[PRIMARY TASK FLOW]
Industry-specific main flow. Step-by-step with clear instructions.
Each step MUST:
- Have a clear instruction
- End with: <wait for user response>
- Ask ONE question only
- Include smart suggestions from KB when relevant
Steps must collect all needed info one at a time, then confirm before finalizing.

[SECONDARY TASK FLOWS]
Additional conversation paths relevant to the industry.
Each with <wait for user response> markers.

[FAQ FLOW]
- Answer from knowledge base only
- Keep answers short (1-2 sentences)
- If unsure: "Let me check — I can have someone get back to you."
- After answering, guide back toward main conversion goal
<wait for user response>

[CALL TRANSFER FLOW]
Trigger: user upset, asks for human, complex issue.
"I completely understand. Let me connect you with our team right away."

[MEMORY + CONTEXT]
- Remember everything the caller said
- Don't re-ask known info
- Use their name naturally if given

[STRICT RULES]
- Never guess or make up information
- Never overwhelm with too much info
- Never ask multiple questions at once
- Never break character
- Always move toward main conversion goal
- Never mention "AI", "system", "function", "tool", or "assistant"
- Spell out all prices and numbers phonetically

[KNOWLEDGE BASE]
Injected business data goes here.

IMPORTANT:
- Make it sound like a REAL person, not a bot
- Use industry-specific vocabulary and flows
- Every task step must have <wait for user response>
- The structure must follow the exact section format above`;

async function generatePromptViaLLM(
  providers: any[],
  industry: string,
  businessName: string,
  agentName: string,
  knowledgeBase: string,
  customInstructions?: string
): Promise<{ system_prompt: string; first_message: string } | null> {
  for (const provider of providers) {
    try {
      console.log(`[generate-voice-prompt] Trying ${provider.name}`);
      const res = await fetchWithTimeout(provider.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${provider.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            { role: "system", content: VAPI_META_PROMPT },
            {
              role: "user",
              content: `Generate a complete VAPI voice agent prompt for:
Industry: ${industry}
Business: ${businessName}
Agent Name: ${agentName}
${customInstructions ? `Custom Instructions: ${customInstructions}` : ""}

Knowledge Base:
${knowledgeBase || "No specific knowledge base provided."}

Return a JSON object with two fields:
1. "system_prompt" — the complete VAPI-structured prompt
2. "first_message" — a natural greeting like "Hey, this is ${agentName} from ${businessName}! How can I help you today?"`,
            },
          ],
          tools: [{
            type: "function",
            function: {
              name: "create_voice_prompt",
              description: "Return the generated voice agent prompt",
              parameters: {
                type: "object",
                properties: {
                  system_prompt: { type: "string", description: "Complete VAPI-structured system prompt" },
                  first_message: { type: "string", description: "Natural greeting message" },
                },
                required: ["system_prompt", "first_message"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "create_voice_prompt" } },
        }),
      }, 60000);

      if (!res.ok) { await res.text(); continue; }
      const data = await res.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        return JSON.parse(toolCall.function.arguments);
      }
    } catch (err) {
      console.warn(`[generate-voice-prompt] ${provider.name} failed:`, err instanceof Error ? err.message : err);
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { industry, business_name, agent_name, knowledge_base, custom_instructions, structured_data } = body;

    if (!business_name) {
      return new Response(JSON.stringify({ error: "business_name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const resolvedIndustry = industry || "general";
    const resolvedAgent = agent_name || "Alex";
    const supabase = supabaseClient;

    // 1. Check for existing template
    const { data: template } = await supabase.from("industry_templates").select("*")
      .eq("industry_name", resolvedIndustry).eq("status", "active").maybeSingle();

    const vars = { business_name, agent_name: resolvedAgent, industry: resolvedIndustry, main_service: structured_data?.main_service || "" };

    if (template?.system_prompt_template) {
      // Use template with variable injection
      const systemPrompt = injectVars(template.system_prompt_template, vars);
      const firstMessage = injectVars(template.first_message_template || `Hey, this is {agent_name} from {business_name}! How can I help you today?`, vars);

      return new Response(JSON.stringify({
        system_prompt: systemPrompt,
        first_message: firstMessage,
        source: "template",
        industry: resolvedIndustry,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. No template — generate via LLM
    const { data: llmProviders } = await supabase.from("api_providers").select("*")
      .eq("category", "llm").eq("is_enabled", true).order("priority", { ascending: true });
    const providers = buildProviderList(llmProviders || []);

    if (providers.length === 0) {
      // Return a sensible default
      const defaultPrompt = `[Identity]\nYou are ${resolvedAgent}, a friendly staff member at ${business_name}.\n\n[Style]\n- Conversational, warm\n- Use contractions\n- 1-3 sentences max\n\n[Task]\nHelp callers with questions about ${business_name}.\n<wait for user response>\n\n[Error Handling]\n- "Sorry, could you say that again?"\n- "Let me have someone get back to you."`;
      return new Response(JSON.stringify({
        system_prompt: defaultPrompt,
        first_message: `Hey, this is ${resolvedAgent} from ${business_name}! How can I help you today?`,
        source: "default",
        industry: resolvedIndustry,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await generatePromptViaLLM(providers, resolvedIndustry, business_name, resolvedAgent, knowledge_base || "", custom_instructions);

    if (!result) {
      return new Response(JSON.stringify({ error: "Failed to generate prompt" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Auto-save as template for reuse
    try {
      await supabase.from("industry_templates").upsert({
        industry_name: resolvedIndustry,
        display_name: `${resolvedIndustry.charAt(0).toUpperCase() + resolvedIndustry.slice(1).replace(/_/g, " ")} (Auto)`,
        system_prompt_template: result.system_prompt.replaceAll(business_name, "{business_name}").replaceAll(resolvedAgent, "{agent_name}"),
        first_message_template: result.first_message.replaceAll(business_name, "{business_name}").replaceAll(resolvedAgent, "{agent_name}"),
        status: "active",
        priority: 5,
      }, { onConflict: "industry_name" });
      console.log(`[generate-voice-prompt] Saved template for ${resolvedIndustry}`);
    } catch { /* non-critical */ }

    return new Response(JSON.stringify({
      system_prompt: result.system_prompt,
      first_message: result.first_message,
      source: "llm_generated",
      industry: resolvedIndustry,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[generate-voice-prompt] Error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
