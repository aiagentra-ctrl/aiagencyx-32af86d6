import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const MANYREACH_URL = "https://api.manyreach.com/api/v2/messages/reply";

function injectVars(t: string, v: Record<string, string>) {
  return t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? `{${k}}`);
}

const FEEDBACK_BODY = `<p>Hey {FirstName},</p>
<p>Thanks for trying our AI Voice Agent demo for {Company}. How was your experience? We'd love your honest feedback — even a one-liner helps.</p>
<p>Reply to this email and let us know.</p>
<p>— {CampaignName}</p>`;

const REENGAGE_BODY = `<p>Hey {FirstName},</p>
<p>I noticed you visited the AI Voice Agent page we set up for {Company}, but didn't get a chance to try it.</p>
<p>It takes under 30 seconds — just click the link from the original email and tap "Try AI Call".</p>
<p>Worth a quick test?</p>
<p>— {CampaignName}</p>`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { lead_id } = await req.json();
    if (!lead_id) return new Response(JSON.stringify({ error: "lead_id required" }), { status: 400, headers: corsHeaders });

    const { data: lead, error } = await supabase.from("demo_leads").select("*").eq("id", lead_id).maybeSingle();
    if (error || !lead) {
      return new Response(JSON.stringify({ error: "lead not found" }), { status: 404, headers: corsHeaders });
    }

    if (!lead.is_complete) return new Response(JSON.stringify({ skipped: "incomplete" }), { headers: corsHeaders });
    if (lead.follow_up_sent_at) return new Response(JSON.stringify({ skipped: "already_sent" }), { headers: corsHeaders });

    // Re-check country
    const { data: rules } = await supabase.from("site_settings").select("key,value").in("key", ["country_allowlist", "country_blocklist"]);
    const allow: string[] = []; const block: string[] = [];
    for (const r of rules || []) {
      const list = (r.value || "").split(",").map((x: string) => x.trim().toUpperCase()).filter(Boolean);
      if (r.key === "country_allowlist") allow.push(...list);
      if (r.key === "country_blocklist") block.push(...list);
    }
    const cc = (lead.country_code || "").toUpperCase();
    if (cc && block.includes(cc)) {
      await supabase.from("demo_leads").update({ status: "blocked_country" }).eq("id", lead.id);
      return new Response(JSON.stringify({ skipped: "blocked_country" }), { headers: corsHeaders });
    }
    if (cc && allow.length > 0 && !allow.includes(cc)) {
      await supabase.from("demo_leads").update({ status: "blocked_country" }).eq("id", lead.id);
      return new Response(JSON.stringify({ skipped: "country_not_allowed" }), { headers: corsHeaders });
    }

    const variables = {
      FirstName: lead.first_name || "there",
      Company: lead.company || "your company",
      CampaignName: lead.campaign_name || "the team",
      Industry: lead.industry || "",
    };
    const body = injectVars(lead.demo_tried ? FEEDBACK_BODY : REENGAGE_BODY, variables);

    const payload: any = {
      threadId: lead.message_thread_id,
      sendAsReply: true,
      from: lead.sender_email,
      cc: lead.cc_emails || [],
      bcc: lead.bcc_emails || [],
      body,
      variables,
      campaignId: lead.campaign_id,
      metadata: {
        slug: lead.slug,
        lead_score: lead.lead_score,
        score_tier: lead.score_tier,
        demo_tried: lead.demo_tried,
        demo_type: lead.demo_type_tried,
      },
    };

    const apiKey = Deno.env.get("MANYREACH_API_KEY");
    let status = "sent"; let responseJson: any = null; let errorMessage: string | null = null;

    if (!apiKey) {
      status = "failed";
      errorMessage = "MANYREACH_API_KEY not configured";
    } else {
      try {
        const res = await fetch(MANYREACH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
          body: JSON.stringify(payload),
        });
        responseJson = await res.json().catch(() => ({}));
        if (!res.ok) { status = "failed"; errorMessage = `HTTP ${res.status}: ${JSON.stringify(responseJson).slice(0, 500)}`; }
      } catch (e) {
        status = "failed";
        errorMessage = e instanceof Error ? e.message : "fetch failed";
      }
    }

    await supabase.from("manyreach_logs").insert({
      lead_id: lead.id, slug: lead.slug, campaign_id: lead.campaign_id, thread_id: lead.message_thread_id,
      status, lead_score: lead.lead_score, request_payload: payload, response_payload: responseJson, error_message: errorMessage,
    });

    if (status === "sent") {
      await supabase.from("demo_leads").update({
        follow_up_sent_at: new Date().toISOString(),
        follow_up_message_id: responseJson?.messageId || responseJson?.id || null,
        status: "followed_up",
      }).eq("id", lead.id);
    }

    return new Response(JSON.stringify({ ok: status === "sent", status, error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("trigger-follow-up error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: corsHeaders });
  }
});
