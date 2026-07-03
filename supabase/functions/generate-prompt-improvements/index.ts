// Weekly aggregator: reads analyzed sessions for a chatbot and proposes
// concrete improvements to the system prompt. Stores suggestions in
// prompt_improvement_suggestions for admin review.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { chatCompletion, MODELS } from "../_shared/openrouter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function processChatbot(chatbotId: string) {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data: sessions } = await supabase
    .from("chatbot_sessions")
    .select("outcome, sentiment, analysis, topics")
    .eq("chatbot_id", chatbotId)
    .gt("started_at", since)
    .not("analyzed_at", "is", null)
    .limit(100);
  if (!sessions || sessions.length < 3) return { chatbotId, skipped: true, reason: "not enough analyzed sessions" };

  const { data: bot } = await supabase
    .from("chatbots").select("system_prompt, business_name").eq("id", chatbotId).maybeSingle();
  if (!bot) return { chatbotId, skipped: true, reason: "chatbot missing" };

  const issues = sessions.flatMap((s: any) => (s.analysis?.issues ?? []));
  const wins = sessions.flatMap((s: any) => (s.analysis?.wins ?? []));
  const outcomes = sessions.reduce((acc: any, s: any) => {
    const k = s.outcome || "unknown"; acc[k] = (acc[k] || 0) + 1; return acc;
  }, {});

  const result = await chatCompletion(MODELS.kb_build, [
    { role: "system", content: "You are a prompt engineer for e-commerce AI assistants. Output valid JSON only." },
    { role: "user", content: `Analyze one week of chat behaviour for ${bot.business_name} and propose concrete edits.

OUTCOME COUNTS: ${JSON.stringify(outcomes)}
TOP ISSUES: ${JSON.stringify(issues.slice(0, 30))}
TOP WINS: ${JSON.stringify(wins.slice(0, 20))}

Return JSON:
{
  "suggestions": [
    {
      "title": "short",
      "reasoning": "why (cite issues)",
      "prompt_patch": "additional guidance to append to the system prompt (verbatim)",
      "priority": "high|medium|low"
    }
  ],
  "summary": "one paragraph"
}` },
  ], { temperature: 0.3, max_tokens: 900, response_format: { type: "json_object" } });

  let parsed: any = {};
  try { parsed = JSON.parse(result?.content || "{}"); } catch { /* ignore */ }

  await supabase.from("prompt_improvement_suggestions").insert({
    chatbot_id: chatbotId,
    sessions_analyzed: sessions.length,
    outcomes,
    summary: parsed.summary ?? null,
    suggestions: parsed.suggestions ?? [],
    status: "pending",
  });

  return { chatbotId, count: sessions.length, suggestions: parsed.suggestions?.length ?? 0 };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    let chatbotIds: string[] = [];
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body.chatbot_id) chatbotIds = [body.chatbot_id];
    }
    if (chatbotIds.length === 0) {
      const { data } = await supabase.from("chatbots").select("id").eq("status", "active").limit(50);
      chatbotIds = (data ?? []).map((r: any) => r.id);
    }
    const results = [];
    for (const id of chatbotIds) results.push(await processChatbot(id));
    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});