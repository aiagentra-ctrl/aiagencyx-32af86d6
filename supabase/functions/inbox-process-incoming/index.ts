// Orchestrator: classify -> (maybe) create demo -> generate reply -> send reply
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function call(path: string, body: any) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* ignore */ }
  if (!r.ok) throw new Error(`${path} failed: ${r.status} ${text}`);
  return json;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { prospect_id, message_id } = await req.json();
    if (!prospect_id || !message_id) {
      return new Response(JSON.stringify({ error: "prospect_id and message_id required" }), { status: 400, headers: corsHeaders });
    }

    const { data: prospect } = await supabase.from("prospects").select("*").eq("id", prospect_id).single();
    if (!prospect) return new Response(JSON.stringify({ error: "prospect not found" }), { status: 404, headers: corsHeaders });
    if (prospect.automation_paused) {
      return new Response(JSON.stringify({ ok: true, skipped: "automation_paused" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) classify
    const { classification } = await call("inbox-classify", { prospect_id, message_id });

    // 2) demo (Positive / Negative -> ensure demo. Objection -> only if no demo yet AND we have website.)
    const { data: existingDemo } = await supabase
      .from("inbox_demos").select("demo_url").eq("prospect_id", prospect_id).order("created_at", { ascending: false }).limit(1).maybeSingle();

    let demoUrl: string | undefined = existingDemo?.demo_url;

    const shouldCreateDemo = !demoUrl && prospect.website_url && classification !== "Negative";
    if (shouldCreateDemo) {
      try {
        const demoRes = await call("create-demo", {
          business_name: prospect.company || prospect.firstname || prospect.email,
          website_url: prospect.website_url,
          firstName: prospect.firstname,
          campaignName: prospect.campaign_name,
          campaignId: prospect.campaign_id,
          senderEmail: prospect.sender_email,
          company: prospect.company,
          replyToEmail: prospect.reply_to_email,
        });
        demoUrl = demoRes?.demo_url;
        if (demoUrl) {
          await supabase.from("inbox_demos").insert({
            prospect_id,
            demo_url: demoUrl,
            business_name: prospect.company || prospect.firstname || prospect.email,
          });
        }
      } catch (e) {
        console.error("create-demo failed (continuing without demo):", e);
      }
    }

    // 3) generate reply
    const { reply } = await call("inbox-generate-reply", {
      prospect_id, classification, demo_url: demoUrl,
    });

    // 4) send reply
    const send = await call("inbox-send-reply", {
      prospect_id, body: reply, classified_by: "ai",
    });

    return new Response(JSON.stringify({ ok: true, classification, demo_url: demoUrl, send }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("inbox-process-incoming error:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: corsHeaders });
  }
});
