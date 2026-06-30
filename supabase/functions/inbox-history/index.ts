// Returns prior inbox messages for a prospect email (n8n `history` tool parity).
// Used by both the classifier (as context) and the dashboard.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    let email = url.searchParams.get("email") || "";
    if (!email && (req.method === "POST")) {
      const b = await req.json().catch(() => ({}));
      email = b?.email || "";
    }
    if (!email) {
      return new Response(JSON.stringify({ error: "email required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: prospect } = await supabase
      .from("prospects").select("id, firstname, company, demo_sent_at, client_memory")
      .eq("email", email).maybeSingle();

    if (!prospect) {
      return new Response(JSON.stringify({ email, messages: [], demo_sent: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: msgs } = await supabase
      .from("inbox_messages")
      .select("direction, body, subject, classification, created_at")
      .eq("prospect_id", prospect.id)
      .order("created_at", { ascending: true });

    const demoSent = (msgs || []).some(
      (m) => m.direction === "outgoing" && (m.body || "").includes("aiagentfor.lovable.app"),
    ) || !!prospect.demo_sent_at;

    return new Response(JSON.stringify({
      email,
      prospect: { firstname: prospect.firstname, company: prospect.company, client_memory: prospect.client_memory },
      demo_sent: demoSent,
      messages: msgs || [],
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});