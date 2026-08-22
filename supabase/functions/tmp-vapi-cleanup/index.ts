import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const { assistants = [], files = [] } = await req.json().catch(() => ({}));
  const key = Deno.env.get("VAPI_API_KEY") || "";
  const out: Record<string, number> = {};
  for (const id of assistants) {
    const r = await fetch(`https://api.vapi.ai/assistant/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${key}` } });
    out[`assistant:${id}`] = r.status;
  }
  for (const id of files) {
    const r = await fetch(`https://api.vapi.ai/file/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${key}` } });
    out[`file:${id}`] = r.status;
  }
  return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
