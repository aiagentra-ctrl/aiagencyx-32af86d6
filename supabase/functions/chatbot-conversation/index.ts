import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { chatbotId, sessionId, message } = await req.json();

    if (!chatbotId || !sessionId || !message) {
      return new Response(
        JSON.stringify({ error: "chatbotId, sessionId, and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Load chatbot config
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

    // Load or create conversation
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

    // Determine AI provider
    let apiUrl: string;
    let apiKey: string;
    let model: string;

    if (chatbot.ai_provider === "lovable" || !chatbot.ai_provider) {
      const lovableKey = Deno.env.get("LOVABLE_API_KEY");
      if (!lovableKey) {
        return new Response(
          JSON.stringify({ error: "AI service not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
      apiKey = lovableKey;
      model = chatbot.ai_model || "google/gemini-3-flash-preview";
    } else {
      // Custom provider — use stored API key
      if (!chatbot.api_key_encrypted) {
        return new Response(
          JSON.stringify({ error: "No API key configured for this chatbot" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      apiKey = chatbot.api_key_encrypted;
      model = chatbot.ai_model || "gpt-4";

      switch (chatbot.ai_provider) {
        case "openai":
          apiUrl = "https://api.openai.com/v1/chat/completions";
          break;
        case "openrouter":
          apiUrl = "https://openrouter.ai/api/v1/chat/completions";
          break;
        default:
          apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
          apiKey = Deno.env.get("LOVABLE_API_KEY")!;
      }
    }

    // Build messages for AI
    const aiMessages = [
      { role: "system", content: chatbot.system_prompt },
      ...updatedMessages.map((m: any) => ({ role: m.role, content: m.content })),
    ];

    // Call AI with streaming
    const aiRes = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: aiMessages,
        stream: true,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI error:", aiRes.status, errText);
      if (aiRes.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiRes.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "AI request failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a transform stream to capture the full response while streaming
    let fullResponse = "";
    const { readable, writable } = new TransformStream({
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk);
        // Parse SSE to capture content
        for (const line of text.split("\n")) {
          if (line.startsWith("data: ") && line.slice(6).trim() !== "[DONE]") {
            try {
              const parsed = JSON.parse(line.slice(6));
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) fullResponse += content;
            } catch {
              // ignore parse errors in stream
            }
          }
        }
        controller.enqueue(chunk);
      },
      async flush() {
        // Save conversation after streaming completes
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
