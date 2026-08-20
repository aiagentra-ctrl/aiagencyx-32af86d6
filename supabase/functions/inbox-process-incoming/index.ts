// Orchestrator: classify -> (maybe) create demo -> generate reply (template-first + AI fallback) -> send reply
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { traceStep, logError } from "../_shared/observability.ts";
import { resolveWebsite } from "../_shared/website.ts";

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


const SAFE_FALLBACK = "Thanks for your message — I'll get back to you shortly.";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  let prospect_id: string | null = null;
  let message_id: string | null = null;
  let releaseLock: (() => Promise<void>) | null = null;

  try {
    const body = await req.json();
    prospect_id = body.prospect_id; message_id = body.message_id;
    if (!prospect_id || !message_id) {
      return new Response(JSON.stringify({ error: "prospect_id and message_id required" }), { status: 400, headers: corsHeaders });
    }

    const { data: prospect } = await supabase.from("prospects").select("*").eq("id", prospect_id).single();
    if (!prospect) return new Response(JSON.stringify({ error: "prospect not found" }), { status: 404, headers: corsHeaders });

    // Second-layer guard: blocked / unsubscribed addresses never get processed.
    const { data: blockRow } = await supabase
      .from("unsubscribed_prospects").select("id").ilike("email", prospect.email).maybeSingle();
    if (blockRow) {
      await traceStep(prospect_id, message_id, "classified", "skipped", { reason: "blocked_unsubscribed" });
      return new Response(JSON.stringify({ ok: true, skipped: "blocked_unsubscribed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (prospect.automation_paused) {
      await traceStep(prospect_id, message_id, "classified", "skipped", { reason: "automation_paused" });
      return new Response(JSON.stringify({ ok: true, skipped: "automation_paused" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Concurrency lock: one pipeline per lead at a time ───────────────
    // Two webhook deliveries for the same reply used to race here and each
    // built a demo + sent a reply. The lock makes that impossible.
    const lockKey = `inbox:${prospect_id}`;
    const lockHolder = `${message_id}:${crypto.randomUUID().slice(0, 8)}`;
    const { data: gotLock } = await supabase.rpc("try_acquire_pipeline_lock", {
      p_key: lockKey, p_holder: lockHolder, p_ttl_seconds: 180,
    });
    if (!gotLock) {
      await traceStep(prospect_id, message_id, "classified", "skipped", { reason: "already_processing" });
      return new Response(JSON.stringify({ ok: true, skipped: "already_processing" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    releaseLock = async () => {
      await supabase.rpc("release_pipeline_lock", { p_key: lockKey, p_holder: lockHolder });
    };


    // Duplicate-send guard: if we already replied to this lead moments ago,
    // this delivery is a repeat — never send a second message.
    const { data: recentOut } = await supabase
      .from("inbox_messages").select("id, created_at")
      .eq("prospect_id", prospect_id).eq("direction", "outgoing")
      .gte("created_at", new Date(Date.now() - 10 * 60_000).toISOString())
      .limit(1);
    if (recentOut && recentOut.length > 0) {
      await traceStep(prospect_id, message_id, "reply_generated", "skipped", { reason: "recent_reply_already_sent" });
      return new Response(JSON.stringify({ ok: true, skipped: "recent_reply_already_sent" }), {
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

    // Recovery: a demo may already have been built for this address in an
    // earlier run without an inbox_demos row. Reuse it instead of building a
    // second demo for the same lead.
    if (!demoUrl) {
      const { data: priorJob } = await supabase
        .from("demo_jobs").select("result").ilike("email", prospect.email)
        .eq("status", "completed").order("created_at", { ascending: false }).limit(1).maybeSingle();
      const priorUrl = (priorJob?.result as any)?.demo_url;
      if (priorUrl) {
        demoUrl = priorUrl;
        await supabase.from("inbox_demos").insert({
          prospect_id, demo_url: demoUrl,
          business_name: prospect.company || prospect.firstname || prospect.email,
        });
        await traceStep(prospect_id, message_id, "demo", "ok", { demo_url: demoUrl, reused: true });
      }
    }


    const phase: "pre_demo" | "post_demo" = demoUrl ? "post_demo" : "pre_demo";

    // Website resolution: ManyReach frequently omits the website field. Falling
    // back to the email domain is what keeps the demo flow alive — without it
    // demo creation was skipped and every positive reply died on
    // `demo_link_missing`.
    let websiteUrl = resolveWebsite(prospect.website_url, prospect.email);
    if (websiteUrl && websiteUrl !== prospect.website_url) {
      await supabase.from("prospects").update({ website_url: websiteUrl }).eq("id", prospect_id);
      await traceStep(prospect_id, message_id, "demo", "ok", { website_resolved: websiteUrl, from: "email_domain" });
    }

    // n8n parity: all three branches (Positive / Negative / Objection) flow
    // through `create-demo`. Only skip if we already have a demo or no website.
    const shouldCreateDemo = phase === "pre_demo" && !!websiteUrl;

    if (shouldCreateDemo) {
      try {
        const demoRes = await call("create-demo", {
          business_name: prospect.company || prospect.firstname || prospect.email,
          website_url: websiteUrl,
          firstName: prospect.firstname,
          campaignName: prospect.campaign_name,
          campaignId: prospect.campaign_id,
          senderEmail: prospect.sender_email,
          company: prospect.company,
          replyToEmail: prospect.reply_to_email,
          email: prospect.email,
          prospect_id,
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
        await logError("demo", m, { prospect_id, message_id, stack: (e as any)?.stack, is_test: !!prospect.is_test_data });
        await traceStep(prospect_id, message_id, "demo", "failed", null, m);
      }
    } else {
      await traceStep(prospect_id, message_id, "demo", "skipped", {
        reason: phase === "post_demo" ? "already_sent" : "no_website",
        demo_url: demoUrl,
      });
    }


    // 3) reply: template-first, AI fallback, then safe-generic
    const effectivePhase: "pre_demo" | "post_demo" = demoUrl ? "post_demo" : "pre_demo";

    let reply = "";
    let replySource: "ai" | "fallback" = "fallback";
    let blocked: string | null = null;

    try {
      const out = await call("inbox-generate-reply", { prospect_id, classification, demo_url: demoUrl });
      if (out?.blocked) {
        blocked = out.block_reason || "blocked";
      } else {
        reply = (out?.reply || "").trim();
        if (reply) replySource = "ai";
      }
    } catch (e) {
      const m = String((e as any)?.message || e);
      await logError("reply_generation", m, { prospect_id, message_id, stack: (e as any)?.stack, is_test: !!prospect.is_test_data });
    }

    // Hard stop: opt-out, missing demo link, or duplicate template. Nothing is
    // sent — the message is flagged for manual review instead.
    if (blocked) {
      // `hard_opt_out` is intended behaviour (the lead asked us to stop), not a
      // system fault, so it never lands in the error feed. Anything else is a
      // real gap in the flow and stays reportable.
      const expected = blocked === "hard_opt_out";
      await traceStep(prospect_id, message_id, "reply_generated", "skipped", { reason: blocked, classification });
      if (!expected) {
        await logError("reply_generation", `send blocked: ${blocked}`, { prospect_id, message_id, is_test: !!prospect.is_test_data });
      }
      await supabase.from("notifications").insert({
        type: "needs_review", prospect_id,
        message: expected
          ? `Lead opted out — automation stopped for ${prospect.email}`
          : `Reply held for review (${blocked}) — ${prospect.email}`,
      });
      return new Response(JSON.stringify({ ok: true, blocked, classification, demo_url: demoUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    if (!reply) {
      reply = SAFE_FALLBACK;
      replySource = "fallback";
      await logError("reply_generation", "Used safe fallback reply", { prospect_id, message_id, is_test: !!prospect.is_test_data });
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
        await logError("send", "ManyReach send returned not ok", { prospect_id, message_id, is_test: !!prospect.is_test_data });
      }
    } catch (e) {
      const m = String((e as any)?.message || e);
      await logError("send", m, { prospect_id, message_id, stack: (e as any)?.stack, is_test: !!prospect.is_test_data });

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
  } finally {
    if (releaseLock) { try { await releaseLock(); } catch { /* lock expires on its own */ } }
  }

});
