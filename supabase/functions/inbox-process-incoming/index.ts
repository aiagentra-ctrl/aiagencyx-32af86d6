// Orchestrator: classify -> (maybe) create demo -> generate reply (template-first + AI fallback) -> send reply
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { traceStep, logError } from "../_shared/observability.ts";

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

function fillTemplate(body: string, vars: Record<string, string>) {
  return body.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

const SAFE_FALLBACK = "Thanks for your message — I'll get back to you shortly.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  let prospect_id: string | null = null;
  let message_id: string | null = null;
  try {
    const body = await req.json();
    prospect_id = body.prospect_id; message_id = body.message_id;
    if (!prospect_id || !message_id) {
      return new Response(JSON.stringify({ error: "prospect_id and message_id required" }), { status: 400, headers: corsHeaders });
    }

    const { data: prospect } = await supabase.from("prospects").select("*").eq("id", prospect_id).single();
    if (!prospect) return new Response(JSON.stringify({ error: "prospect not found" }), { status: 404, headers: corsHeaders });
    if (prospect.automation_paused) {
      await traceStep(prospect_id, message_id, "classified", "skipped", { reason: "automation_paused" });
      return new Response(JSON.stringify({ ok: true, skipped: "automation_paused" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) classify
    let classification: "Positive" | "Negative" | "Objection" = "Objection";
    try {
      const c = await call("inbox-classify", { prospect_id, message_id });
      classification = c.classification;
    } catch (e) {
      const m = String((e as any)?.message || e);
      await logError("classify", m, { prospect_id, message_id, stack: (e as any)?.stack });
      await traceStep(prospect_id, message_id, "classified", "failed", null, m);
      throw e;
    }

    // 2) demo phase detection
    const { data: existingDemo } = await supabase
      .from("inbox_demos").select("demo_url").eq("prospect_id", prospect_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    let demoUrl: string | undefined = existingDemo?.demo_url;
    const phase: "pre_demo" | "post_demo" = demoUrl ? "post_demo" : "pre_demo";

    // Only create a demo if pre_demo and not Negative and we have a website
    const shouldCreateDemo = phase === "pre_demo" && prospect.website_url && classification !== "Negative";
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
          await supabase.from("prospects").update({ demo_sent_at: new Date().toISOString() }).eq("id", prospect_id);
          await traceStep(prospect_id, message_id, "demo", "ok", { demo_url: demoUrl });
        } else {
          await traceStep(prospect_id, message_id, "demo", "failed", { demoRes }, "no demo_url returned");
        }
      } catch (e) {
        const m = String((e as any)?.message || e);
        await logError("demo", m, { prospect_id, message_id, stack: (e as any)?.stack });
        await traceStep(prospect_id, message_id, "demo", "failed", null, m);
      }
    } else {
      await traceStep(prospect_id, message_id, "demo", "skipped", {
        reason: phase === "post_demo" ? "already_sent" : classification === "Negative" ? "negative" : "no_website",
        demo_url: demoUrl,
      });
    }

    // 3) reply: template-first, AI fallback, then safe-generic
    const effectivePhase: "pre_demo" | "post_demo" = demoUrl ? "post_demo" : "pre_demo";
    const senderName = (prospect.sender_email || "").split("@")[0]?.split(/[._-]/).filter(Boolean).map((p: string) => p[0].toUpperCase() + p.slice(1)).join(" ") || "the team";

    const vars: Record<string, string> = {
      firstname: prospect.firstname || "there",
      company: prospect.company || "your team",
      sender_name: senderName,
      sender_email: prospect.sender_email || "",
      demo_url: demoUrl || "",
    };

    let reply = "";
    let replySource: "template" | "ai" | "fallback" = "fallback";

    const { data: tpl } = await supabase
      .from("reply_templates")
      .select("body, locked_vars")
      .eq("classification", classification)
      .eq("phase", effectivePhase)
      .eq("is_default", true)
      .maybeSingle();

    if (tpl?.body) {
      reply = fillTemplate(tpl.body, vars).trim();
      // safety: strip stray demo_url chips if post_demo somehow leaked through
      if (effectivePhase === "post_demo" && !demoUrl) {
        reply = reply.replace(/https?:\/\/\S*aiagentfor\.lovable\.app\S*/gi, "").trim();
      }
      replySource = "template";
    } else {
      try {
        const out = await call("inbox-generate-reply", { prospect_id, classification, demo_url: demoUrl });
        reply = (out?.reply || "").trim();
        if (reply) replySource = "ai";
      } catch (e) {
        const m = String((e as any)?.message || e);
        await logError("reply_generation", m, { prospect_id, message_id, stack: (e as any)?.stack });
      }
    }

    if (!reply) {
      reply = SAFE_FALLBACK;
      replySource = "fallback";
      await logError("reply_generation", "Used safe fallback reply", { prospect_id, message_id });
    }

    await traceStep(prospect_id, message_id, "reply_generated", "ok", {
      source: replySource, phase: effectivePhase, classification, preview: reply.slice(0, 200),
    });

    // 4) send reply
    let send: any = null;
    try {
      send = await call("inbox-send-reply", { prospect_id, body: reply, classified_by: "ai" });
      await traceStep(prospect_id, message_id, "sent", send?.ok ? "ok" : "failed", { manyreach_ok: send?.ok }, send?.ok ? null : "manyreach send failed");
      if (!send?.ok) {
        await logError("send", "ManyReach send returned not ok", { prospect_id, message_id });
      }
    } catch (e) {
      const m = String((e as any)?.message || e);
      await logError("send", m, { prospect_id, message_id, stack: (e as any)?.stack });
      await traceStep(prospect_id, message_id, "sent", "failed", null, m);
      throw e;
    }

    return new Response(JSON.stringify({ ok: true, classification, demo_url: demoUrl, reply_source: replySource, send }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("inbox-process-incoming error:", e);
    const m = String((e as any)?.message || e);
    await logError("orchestrator", m, { prospect_id, message_id, stack: (e as any)?.stack });
    return new Response(JSON.stringify({ error: m }), { status: 500, headers: corsHeaders });
  }
});
