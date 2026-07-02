// Generate an AI reply for a prospect based on classification.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getOrCreateMemory, canSendDemoLink, stripDemoUrls } from "../_shared/memory.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

// Map classification → node_prompts.node_name
const CLASS_TO_NODE: Record<string, string> = {
  Positive: "positive_reply",
  Negative: "negative_reply",
  Objection: "objection_reply",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { prospect_id, classification, demo_url } = await req.json();
    if (!prospect_id || !classification) {
      return new Response(JSON.stringify({ error: "prospect_id and classification required" }), { status: 400, headers: corsHeaders });
    }

    const nodeName = CLASS_TO_NODE[classification] ?? null;
    const [{ data: prospect }, { data: nodePromptRow }, { data: legacyPromptRow }, { data: messages }, { data: existingDemo }, memory] = await Promise.all([
      supabase.from("prospects").select("*").eq("id", prospect_id).single(),
      nodeName
        ? supabase.from("node_prompts").select("system_prompt, model").eq("node_name", nodeName).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("inbox_prompts").select("system_prompt").eq("classification", classification).maybeSingle(),
      supabase.from("inbox_messages").select("direction, body, created_at").eq("prospect_id", prospect_id).order("created_at", { ascending: true }).limit(20),
      supabase.from("inbox_demos").select("demo_url").eq("prospect_id", prospect_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      getOrCreateMemory(prospect_id),
    ]);

    if (!prospect) {
      return new Response(JSON.stringify({ error: "prospect not found" }), { status: 404, headers: corsHeaders });
    }

    // Layer 1: memory check — if demo already sent, LOCK the link out.
    const demoAllowed = canSendDemoLink(memory);
    const usableDemoUrl = demoAllowed ? (demo_url || existingDemo?.demo_url || "") : "";

    const rawPrompt =
      nodePromptRow?.system_prompt ||
      legacyPromptRow?.system_prompt ||
      "Reply briefly and politely.";
    const model = nodePromptRow?.model || "google/gemini-3-flash-preview";
    // Substitute {{demo_url}} inside the agent's system prompt so the model
    // always has the exact URL available even if it ignores the user context.
    let systemPrompt = rawPrompt.replace(/\{\{\s*demo_url\s*\}\}/gi, usableDemoUrl);

    // Layer 2: prompt injection — hard instruction never to send demo link
    // if it's already been sent.
    if (!demoAllowed) {
      systemPrompt += `\n\nSTRICT RULE: A demo link has already been sent to this prospect. Under no circumstances include a demo URL, demo link, or any URL of the form /demo/... in your reply. Focus on continuing the conversation.`;
    }

    const lastIncoming = [...(messages || [])].reverse().find((m: any) => m.direction === "incoming");
    const context = `Prospect:
- firstname: ${prospect.firstname || "there"}
- company: ${prospect.company || "(unknown)"}
- email: ${prospect.email}
demo_url: ${demoAllowed ? (usableDemoUrl || "(none yet)") : "(ALREADY SENT — DO NOT INCLUDE)"}

User's last message:
${lastIncoming?.body || "(no incoming yet)"}

Recent thread (oldest -> newest):
${(messages || []).map((m) => `[${m.direction}] ${m.body}`).join("\n\n")}

Write the reply body now.${demoAllowed ? " Use the demo_url exactly as given." : ""}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": LOVABLE_API_KEY },
      body: JSON.stringify({
        model,
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
    let reply: string = (j?.choices?.[0]?.message?.content || "").trim();

    // Layer 3: sanitizer — even if the model ignored both prior layers,
    // scrub any demo URL from the output.
    let sanitized = false;
    if (!demoAllowed) {
      const before = reply;
      reply = stripDemoUrls(reply);
      sanitized = before !== reply;
    }

    return new Response(JSON.stringify({
      reply,
      demo_url: usableDemoUrl,
      demo_link_locked: !demoAllowed,
      sanitizer_fired: sanitized,
      model,
      node_prompt_used: !!nodePromptRow,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("inbox-generate-reply error:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: corsHeaders });
  }
});
