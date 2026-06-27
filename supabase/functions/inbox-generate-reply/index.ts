// Generate an AI reply for a prospect based on classification.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { prospect_id, classification, demo_url } = await req.json();
    if (!prospect_id || !classification) {
      return new Response(JSON.stringify({ error: "prospect_id and classification required" }), { status: 400, headers: corsHeaders });
    }

    const [{ data: prospect }, { data: promptRow }, { data: messages }, { data: existingDemo }] = await Promise.all([
      supabase.from("prospects").select("*").eq("id", prospect_id).single(),
      supabase.from("inbox_prompts").select("system_prompt").eq("classification", classification).maybeSingle(),
      supabase.from("inbox_messages").select("direction, body, created_at").eq("prospect_id", prospect_id).order("created_at", { ascending: true }).limit(20),
      supabase.from("inbox_demos").select("demo_url").eq("prospect_id", prospect_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    if (!prospect) {
      return new Response(JSON.stringify({ error: "prospect not found" }), { status: 404, headers: corsHeaders });
    }

    const systemPrompt = promptRow?.system_prompt || "Reply briefly and politely.";
    const usableDemoUrl = demo_url || existingDemo?.demo_url || "";

    const context = `Prospect:
- firstname: ${prospect.firstname || "there"}
- company: ${prospect.company || "(unknown)"}
- email: ${prospect.email}
demo_url: ${usableDemoUrl || "(none yet)"}

Recent thread (oldest -> newest):
${(messages || []).map((m) => `[${m.direction}] ${m.body}`).join("\n\n")}

Write the reply body now.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: context },
        ],
        temperature: 0.7,
        max_tokens: 350,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.error("generate-reply LLM error:", res.status, t);
      return new Response(JSON.stringify({ error: "llm_failed", status: res.status, detail: t }), { status: 502, headers: corsHeaders });
    }
    const j = await res.json();
    const reply: string = (j?.choices?.[0]?.message?.content || "").trim();
    return new Response(JSON.stringify({ reply, demo_url: usableDemoUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("inbox-generate-reply error:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: corsHeaders });
  }
});
