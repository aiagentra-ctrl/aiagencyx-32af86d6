import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getSupabase() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
}

function randomSuffix(): string {
  return Math.random().toString(36).substring(2, 6);
}

function injectVars(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{${key}}`, value);
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = getSupabase();

  try {
    const { business_name, website_url, system_prompt, knowledge_base, logo_url, industry, demo_page_id } = await req.json();

    if (!business_name) {
      return new Response(JSON.stringify({ error: "business_name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: settings } = await supabase.from("site_settings").select("key, value");
    const adminSettings: Record<string, string> = {};
    if (settings) for (const row of settings) { adminSettings[row.key] = row.value || ""; }

    const templateVars = { business_name };
    const prompt = system_prompt || injectVars(
      adminSettings.default_system_prompt || `You are the AI assistant for ${business_name}. Be friendly, professional, and helpful.`,
      templateVars
    );
    const fullPrompt = knowledge_base ? `${prompt}\n\n## Knowledge Base\n${knowledge_base}` : prompt;

    const chatbotGreeting = injectVars(
      adminSettings.chatbot_greeting || "Welcome to {business_name}! How can I help you today?",
      templateVars
    );

    let chatbotSlug = slugify(business_name + "-chat");
    if (!chatbotSlug) chatbotSlug = "chatbot";
    const { data: existing } = await supabase.from("chatbots").select("id").eq("slug", chatbotSlug).maybeSingle();
    if (existing) chatbotSlug = `${chatbotSlug}-${randomSuffix()}`;

    const { data: chatbot, error: chatErr } = await supabase.from("chatbots").insert({
      business_name,
      website_url: website_url || null,
      slug: chatbotSlug,
      system_prompt: fullPrompt,
      industry: industry || "General",
      brand_tone: "Professional and friendly",
      logo_url: logo_url || null,
      widget_config: {
        greeting: chatbotGreeting,
        position: adminSettings.chatbot_position || "bottom-right",
        logo: logo_url || null,
      },
      demo_page_id: demo_page_id || null,
    }).select().single();

    if (chatErr) {
      return new Response(JSON.stringify({ error: "Failed to create chatbot" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      chatbot_id: chatbot.id,
      chatbot_slug: chatbot.slug,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
