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

const FALLBACK = {
  not_tried: {
    subject: "Quick follow-up about {Company}",
    body: `<p>Hi {FirstName},</p><p>I noticed you opened the demo for {Company} but didn't get a chance to try it. Worth a 30-second look?</p><p><a href="{DemoURL}">Open the demo →</a></p>`,
  },
  tried_voice_agent: {
    subject: "Thoughts on the AI voice agent, {FirstName}?",
    body: `<p>Hi {FirstName},</p><p>Saw you tested the voice agent for {Company}. What did you think? Happy to tweak it for {Industry}.</p>`,
  },
  tried_chatbot: {
    subject: "How did the chatbot feel for {Company}?",
    body: `<p>Hi {FirstName},</p><p>Thanks for trying the AI chatbot. Curious if it answered the way you'd want for your customers — reply and I'll fine-tune it.</p>`,
  },
} as const;

function pickCondition(lead: any): "not_tried" | "tried_voice_agent" | "tried_chatbot" {
  if (!lead.demo_tried) return "not_tried";
  if (lead.demo_type_tried === "voice") return "tried_voice_agent";
  if (lead.demo_type_tried === "chatbot") return "tried_chatbot";
  return "not_tried";
}

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

    const siteUrl = Deno.env.get("SITE_URL") || "";
    const variables: Record<string, string> = {
      FirstName: lead.first_name || "there",
      Company: lead.company || "your company",
      CampaignName: lead.campaign_name || "the team",
      Industry: lead.industry || "",
      LeadSource: lead.lead_source || "",
      DemoURL: siteUrl ? `${siteUrl}/${lead.slug}` : `/${lead.slug}`,
      VisitorCountry: lead.country_code || "",
    };

    const condition = pickCondition(lead);
    const { data: tpl } = await supabase.from("follow_up_templates").select("subject,body").eq("condition", condition).maybeSingle();
    const subjectTpl = (tpl?.subject?.trim()) || FALLBACK[condition].subject;
    const bodyTpl = (tpl?.body?.trim()) || FALLBACK[condition].body;
    const subject = injectVars(subjectTpl, variables);
    const body = injectVars(bodyTpl, variables);

    const payload: any = {
      threadId: lead.message_thread_id,
      sendAsReply: true,
      from: lead.sender_email,
      cc: lead.cc_emails || [],
      bcc: lead.bcc_emails || [],
      subject,
      body,
      variables,
      campaignId: lead.campaign_id,
      metadata: {
        slug: lead.slug,
        lead_score: lead.lead_score,
        score_tier: lead.score_tier,
        demo_tried: lead.demo_tried,
        demo_type: lead.demo_type_tried,
        condition,
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
