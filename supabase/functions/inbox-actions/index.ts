// Misc inbox actions: pause toggle, relabel, regenerate AI draft, manual demo trigger.
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
    const { action, prospect_id, message_id, classification, paused } = await req.json();

    if (action === "pause") {
      await supabase.from("prospects").update({ automation_paused: !!paused }).eq("id", prospect_id);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "relabel") {
      if (!["Positive", "Negative", "Objection"].includes(classification)) {
        return new Response(JSON.stringify({ error: "invalid classification" }), { status: 400, headers: corsHeaders });
      }
      await supabase.from("inbox_messages").update({ classification, classified_by: "human" }).eq("id", message_id);
      await supabase.from("prospects").update({ last_classification: classification }).eq("id", prospect_id);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "regenerate") {
      // Use the latest incoming message classification (or recompute)
      const { data: lastIn } = await supabase
        .from("inbox_messages").select("id, classification")
        .eq("prospect_id", prospect_id).eq("direction", "incoming")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      let cls = lastIn?.classification;
      if (!cls && lastIn?.id) {
        const c = await call("inbox-classify", { prospect_id, message_id: lastIn.id });
        cls = c.classification;
      }
      const out = await call("inbox-generate-reply", { prospect_id, classification: cls || "Objection" });
      return new Response(JSON.stringify({ reply: out.reply, classification: cls }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "generate_demo") {
      const { data: prospect } = await supabase.from("prospects").select("*").eq("id", prospect_id).single();
      if (!prospect?.website_url) {
        return new Response(JSON.stringify({ error: "no website_url on prospect" }), { status: 400, headers: corsHeaders });
      }
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
      if (demoRes?.demo_url) {
        await supabase.from("inbox_demos").insert({
          prospect_id, demo_url: demoRes.demo_url,
          business_name: prospect.company || prospect.firstname || prospect.email,
        });
      }
      return new Response(JSON.stringify({ demo_url: demoRes?.demo_url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), { status: 400, headers: corsHeaders });
  } catch (e) {
    console.error("inbox-actions error:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: corsHeaders });
  }
});
