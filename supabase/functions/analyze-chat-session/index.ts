// Analyzes recently-ended chatbot sessions for outcome, sentiment, and
// improvement signals. Can be invoked per-session (POST { session_id }) or
// scheduled hourly to sweep unanalyzed sessions.
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

async function analyzeOne(sessionId: string) {
  const { data: session } = await supabase
    .from("chatbot_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (!session) return { ok: false, error: "session not found" };

  const { data: msgs } = await supabase
    .from("chatbot_messages")
    .select("role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(50);

  const transcript = (msgs ?? []).map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join("\n");
  if (!transcript) return { ok: false, error: "no messages" };

  const result = await chatCompletion(MODELS.kb_build, [
    { role: "system", content: "You analyze e-commerce chatbot transcripts. Return ONLY valid JSON matching the schema — no prose." },
    { role: "user", content: `Analyze this transcript and return JSON:
{
  "outcome": "purchased|browsed|abandoned|got_answer|frustrated",
  "sentiment": "positive|neutral|negative",
  "topics": ["short topic strings"],
  "issues": ["missing info / bot mistakes / confusion points"],
  "wins": ["moments where the bot helped effectively"],
  "summary": "one sentence"
}

TRANSCRIPT:
${transcript.slice(0, 8000)}` },
  ], { temperature: 0.2, max_tokens: 500, response_format: { type: "json_object" } });

  let parsed: any = {};
  try { parsed = JSON.parse(result?.content || "{}"); } catch { /* ignore */ }

  await supabase.from("chatbot_sessions").update({
    outcome: parsed.outcome || null,
    sentiment: parsed.sentiment || null,
    topics: parsed.topics ?? [],
    analysis: parsed,
    analyzed_at: new Date().toISOString(),
  }).eq("id", sessionId);

  return { ok: true, analysis: parsed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    let sessionIds: string[] = [];
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body.session_id) sessionIds = [body.session_id];
    }
    if (sessionIds.length === 0) {
      // Sweep: ended sessions with no analysis in last 24h
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const { data } = await supabase
        .from("chatbot_sessions")
        .select("id")
        .is("analyzed_at", null)
        .gt("ended_at", since)
        .limit(20);
      sessionIds = (data ?? []).map((r: any) => r.id);
    }
    const results = [];
    for (const id of sessionIds) results.push({ id, ...(await analyzeOne(id)) });
    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});