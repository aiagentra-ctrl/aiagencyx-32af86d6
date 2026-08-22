import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data } = await supabase.from("site_settings").select("key, value");
  const map: Record<string, string> = {};
  for (const r of data || []) map[r.key] = r.value || "";
  const key = map.vapi_private_key || Deno.env.get("VAPI_API_KEY");

  const candidates = ["gpt-5.2-chat-latest", "gpt-5.2", "gpt-5.2-instant", "gpt-4o"];
  const results: any[] = [];
  for (const model of candidates) {
    const res = await fetch("https://api.vapi.ai/assistant", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `modeltest-${model}`.slice(0, 40),
        model: { provider: "openai", model, messages: [{ role: "system", content: "test" }], maxTokens: 50 },
      }),
    });
    const txt = await res.text();
    let id: string | null = null;
    try { id = JSON.parse(txt).id ?? null; } catch { /* ignore */ }
    if (id) await fetch(`https://api.vapi.ai/assistant/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${key}` } });
    results.push({ model, status: res.status, ok: res.ok, body: res.ok ? "created+deleted" : txt.slice(0, 300) });
  }

  return new Response(JSON.stringify({ results }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
