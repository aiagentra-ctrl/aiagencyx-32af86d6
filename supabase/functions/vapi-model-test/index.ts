import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
Deno.serve(async () => {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data } = await supabase.from("site_settings").select("key, value");
  const map: Record<string, string> = {};
  for (const r of data || []) map[r.key] = r.value || "";
  const key = map.vapi_private_key || Deno.env.get("VAPI_API_KEY");
  const id = "4daaddc0-7815-45f2-9458-a21eb6db364d";
  const r = await fetch(`https://api.vapi.ai/assistant/${id}`, { headers: { Authorization: `Bearer ${key}` } });
  const a = await r.json();
  const del = await fetch(`https://api.vapi.ai/assistant/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${key}` } });
  return new Response(JSON.stringify({ model: a?.model?.model, provider: a?.model?.provider, tools: (a?.model?.tools||[]).map((t:any)=>t?.function?.name||t.type), deleted: del.status }), { headers: { "Content-Type": "application/json" } });
});
