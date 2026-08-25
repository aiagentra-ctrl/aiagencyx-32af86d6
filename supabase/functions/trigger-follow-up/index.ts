import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
import { sendReply, extractMessageId } from "../_shared/manyreach.ts";

function injectVars(t: string, v: Record<string, string>) {
  return t.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? `{${k}}`);
}

const FALLBACK = {
  case1: {
    subject: "Still looking, {FirstName}?",
    body: `<p>Hi {FirstName},</p><p>You visited the demo for {Company} but didn't get a chance to try the AI assistant.</p><p><a href="{DemoURL}">Try it now →</a></p>`,
  },
  case2: {
    subject: "How did the AI agent do, {FirstName}?",
    body: `<p>Hi {FirstName},</p><p>Thanks for trying the AI agent for {Company}. Did it answer the way you'd want?</p><p><a href="{FeedbackURL}?r=yes&lead={LeadID}">Yes, helpful ✓</a> · <a href="{FeedbackURL}?r=no&lead={LeadID}">Not quite</a></p>`,
  },
} as const;

type Case = "case1" | "case2";

function pickCase(lead: any, override?: string): Case {
  if (override === "case1" || override === "case2") return override;
  if (lead.tried_voice || lead.tried_chat) return "case2";
  return "case1";
}

// Map legacy condition names to new cases for backward-compatible templates
function resolveTemplateConditionKey(c: Case): string[] {
  if (c === "case1") return ["case1", "not_tried"];
  return ["case2", "tried_voice_agent", "tried_chatbot"];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { lead_id, case: caseOverride } = await req.json();
    if (!lead_id) return new Response(JSON.stringify({ error: "lead_id required" }), { status: 400, headers: corsHeaders });

    const { data: lead, error } = await supabase.from("demo_leads").select("*").eq("id", lead_id).maybeSingle();
    if (error || !lead) {
      return new Response(JSON.stringify({ error: "lead not found" }), { status: 404, headers: corsHeaders });
    }

    if (!lead.is_complete) return new Response(JSON.stringify({ skipped: "incomplete" }), { headers: corsHeaders });

    const condition = pickCase(lead, caseOverride);
    if (condition === "case1" && lead.followup_case1_sent) {
      return new Response(JSON.stringify({ skipped: "case1_already_sent" }), { headers: corsHeaders });
    }
    if (condition === "case2" && lead.followup_case2_sent) {
      return new Response(JSON.stringify({ skipped: "case2_already_sent" }), { headers: corsHeaders });
    }

    // Country re-check
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
      FeedbackURL: siteUrl ? `${siteUrl}/feedback` : `/feedback`,
      LeadID: lead.id,
      VisitorCountry: lead.country_code || "",
    };

    // Fetch template — try new key first, fall back to legacy keys
    const keys = resolveTemplateConditionKey(condition);
    const { data: tplRows } = await supabase.from("follow_up_templates").select("condition,subject,body").in("condition", keys);
    const tpl = (tplRows || []).sort((a: any, b: any) => keys.indexOf(a.condition) - keys.indexOf(b.condition))[0];

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
      metadata: { slug: lead.slug, lead_score: lead.lead_score, condition },
      mailboxEmail: lead.sender_email || lead.reply_to_email,
    };

    const replyPayload: any = {
      messageId: lead.message_thread_id,
      threadId: lead.message_thread_id,
      subject,
      body,
      fromEmail: lead.sender_email,
      replyToEmail: lead.reply_to_email || lead.sender_email,
      mailboxEmail: lead.sender_email || lead.reply_to_email,
      sendAsReply: true,
      from: lead.sender_email,
      cc: lead.cc_emails || [],
      bcc: lead.bcc_emails || [],
      variables,
      campaignId: lead.campaign_id,
      metadata: { slug: lead.slug, lead_score: lead.lead_score, condition },
    };
    const res = await sendReply(replyPayload);
    const responseJson: any = res.data ?? {};
    const status = res.ok ? "sent" : "failed";
    const errorMessage = res.ok ? null : res.error;

    await supabase.from("manyreach_logs").insert({
      lead_id: lead.id, slug: lead.slug, campaign_id: lead.campaign_id, thread_id: lead.message_thread_id,
      status, lead_score: lead.lead_score, request_payload: payload, response_payload: responseJson, error_message: errorMessage,
    });

    if (status === "sent") {
      const patch: any = {
        follow_up_sent_at: new Date().toISOString(),
        follow_up_message_id: extractMessageId(responseJson),
        status: "followed_up",
      };
      if (condition === "case1") patch.followup_case1_sent = true;
      if (condition === "case2") { patch.followup_case2_sent = true; patch.feedback_requested = true; }
      await supabase.from("demo_leads").update(patch).eq("id", lead.id);
    }

    return new Response(JSON.stringify({ ok: status === "sent", status, condition, error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("trigger-follow-up error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: corsHeaders });
  }
});
