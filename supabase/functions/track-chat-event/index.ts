// Simple, fast tracker for chatbot product clicks and other engagement events.
// Called by EcommerceChatWindow when a visitor clicks a product card.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const { session_id, chatbot_id, event, product_name, product_url } = body;
    if (!chatbot_id || !session_id || !event) {
      return new Response(JSON.stringify({ error: "chatbot_id, session_id, event required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the chatbot_sessions row (best-effort)
    const { data: sess } = await supabase
      .from("chatbot_sessions")
      .select("id, products_clicked")
      .eq("chatbot_id", chatbot_id)
      .eq("session_id", session_id)
      .maybeSingle();

    if (sess && event === "product_clicked") {
      await supabase
        .from("chatbot_sessions")
        .update({ products_clicked: (sess.products_clicked ?? 0) + 1 })
        .eq("id", sess.id);
    }

    // Log to activity_logs (fire-and-forget best-effort)
    try {
      await supabase.from("activity_logs").insert({
        action: `chat_${event}`,
        entity_type: "chatbot_session",
        entity_id: sess?.id ?? null,
        metadata: { product_name, product_url, session_id, chatbot_id },
      });
    } catch { /* non-critical */ }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});