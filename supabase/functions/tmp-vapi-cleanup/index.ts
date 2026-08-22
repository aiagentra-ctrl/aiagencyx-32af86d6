import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const { assistants = [], files = [] } = await req.json().catch(() => ({}));
  const sb = (await import("https://esm.sh/@supabase/supabase-js@2")).createClient(
    Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: rows } = await sb.from("site_settings").select("key, value").eq("key", "vapi_private_key");
  const key = rows?.[0]?.value || Deno.env.get("VAPI_API_KEY") || "";
  const out: Record<string, string> = {};
  for (const id of assistants) {
    const r = await fetch(`https://api.vapi.ai/assistant/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${key}` } });
    out[`assistant:${id}`] = `${r.status} ${(await r.text()).slice(0, 200)}`;
  }
  for (const id of files) {
    const r = await fetch(`https://api.vapi.ai/file/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${key}` } });
    out[`file:${id}`] = `${r.status} ${(await r.text()).slice(0, 200)}`;
  }
  return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

});
