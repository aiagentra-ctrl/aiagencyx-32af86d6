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

  // If chatbot has a custom provider set, try that first
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

  // Lovable AI
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) {
    providers.push({
      name: "Lovable AI",
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      key: lovableKey,
      model: chatbot.ai_provider === "lovable" ? (chatbot.ai_model || "google/gemini-3-flash-preview") : "google/gemini-3-flash-preview",
    });
  }

  // DB-configured fallback providers
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
      // Skip if already added
      if (!providers.find((x) => x.key === p.api_key)) {
        providers.push({ name: p.name, url, key: p.api_key, model: p.model || "gpt-4" });
      }
    }
  }

  return providers;
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

    // Load chatbot
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

    // Load conversation
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

    // Build AI messages
    const aiMessages = [
      { role: "system", content: chatbot.system_prompt },
      ...updatedMessages.map((m: any) => ({ role: m.role, content: m.content })),
    ];

    // Get provider chain
    const providers = await getProviders(supabase, chatbot);
    if (providers.length === 0) {
      return new Response(
        JSON.stringify({ error: "No AI providers configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let aiRes: Response | null = null;
    let usedProvider = "";

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

        if (res.status === 429 || res.status === 402) {
          console.log(`${provider.name}: ${res.status}, trying next`);
          continue;
        }

        if (!res.ok) {
          const errText = await res.text();
          console.log(`${provider.name}: ${res.status} - ${errText.substring(0, 200)}`);
          continue;
        }

        aiRes = res;
        usedProvider = provider.name;
        break;
      } catch (err) {
        console.log(`${provider.name}: ${err instanceof Error ? err.message : "error"}`);
      }
    }

    if (!aiRes) {
      return new Response(
        JSON.stringify({ error: "All AI providers failed. Please try again later." }),
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
            } catch { /* ignore */ }
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
