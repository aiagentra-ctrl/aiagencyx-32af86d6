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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = getSupabase();

  try {
    const { business_name, system_prompt, knowledge_base } = await req.json();

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

    const templateVars = { business_name };
    const prompt = system_prompt || injectVars(
      adminSettings.default_system_prompt || `You are the AI assistant for ${business_name}. Be friendly, professional, and helpful.`,
      templateVars
    );

    const fullPrompt = knowledge_base ? `${prompt}\n\n## Knowledge Base\n${knowledge_base}` : prompt;
    const firstMessage = injectVars(
      adminSettings.default_first_message || "Hi, thank you for calling {business_name}! How can I help you?",
      templateVars
    );
    const endCallMessage = injectVars(
      adminSettings.default_end_call_message || "Thank you for calling {business_name}. Have a great day!",
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
