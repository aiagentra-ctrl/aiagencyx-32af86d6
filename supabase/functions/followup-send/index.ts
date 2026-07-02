// Sends a follow-up via ManyReach reply API using the prospect's stored
// original_message_id to thread into the same conversation.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logWebhook } from "../_shared/observability.ts";
import { hasDemoUrl, markDemoLinkSent } from "../_shared/memory.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const MANYREACH_API_KEY = Deno.env.get("MANYREACH_API_KEY")!;
const MANYREACH_URL = "https://api.manyreach.com/api/v2/messages/reply";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const t0 = Date.now();
  try {
    const { event_id, prospect_id: pIn, body: bodyIn, subject: subjIn, trigger_key, source, sequence_enrollment_id } = await req.json();

    let event: any = null;
    let prospect_id = pIn;
    if (event_id) {
      const { data: ev } = await supabase.from("followup_events").select("*").eq("id", event_id).single();
      if (!ev) return new Response(JSON.stringify({ error: "event not found" }), { status: 404, headers: corsHeaders });
      event = ev; prospect_id = ev.prospect_id;
    }
    if (!prospect_id) return new Response(JSON.stringify({ error: "prospect_id or event_id required" }), { status: 400, headers: corsHeaders });

    const { data: p } = await supabase.from("prospects").select("*").eq("id", prospect_id).single();
    if (!p) return new Response(JSON.stringify({ error: "prospect not found" }), { status: 404, headers: corsHeaders });

    // Generate body if not supplied
    let subject = event?.message_subject || subjIn || `Re: ${p.firstname || "there"} overview`;
    let body = event?.message_body || bodyIn;
    if (!body) {
      const key = event?.trigger_key || trigger_key;
      const g = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/followup-generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}` },
        body: JSON.stringify({ prospect_id, trigger_key: key }),
      }).then((r) => r.json());
      body = g?.reply || "";
      if (g?.subject) subject = g.subject;
    }
    if (!body) throw new Error("no message body");

    if (!p.original_message_id) throw new Error("prospect has no original_message_id — cannot thread follow-up");

    const payload = {
      messageId: p.original_message_id,
      subject,
      body,
      sendAsReply: "true",
      fromEmail: p.sender_email,
      replyToEmail: p.email,
    };

    const res = await fetch(MANYREACH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": MANYREACH_API_KEY },
      body: JSON.stringify(payload),
    });
    const rj: any = await res.json().catch(() => ({}));
    const ok = res.ok;

    await logWebhook({
      endpoint: "followup-send", method: "POST",
      status: ok ? "success" : "failed", status_code: res.status,
      response_ms: Date.now() - t0,
      payload, response: rj, error: ok ? null : `HTTP ${res.status}`,
      source: "manyreach",
    });

    if (ok) {
      await supabase.from("inbox_messages").insert({
        prospect_id, direction: "outgoing", source: source || "followup",
        subject, body, manyreach_message_id: rj?.messageId || rj?.id || null,
      });
      if (hasDemoUrl(body)) {
        try { await markDemoLinkSent(prospect_id, null); } catch (_) { /* noop */ }
      }
      if (event) {
        await supabase.from("followup_events").update({
          status: "sent", sent_at: new Date().toISOString(),
          message_subject: subject, message_body: body,
          manyreach_message_id: rj?.messageId || rj?.id || null,
        }).eq("id", event.id);
      }
      await supabase.from("prospects").update({
        followup_status: "sent",
        followup_attempts: (p.followup_attempts ?? 0) + 1,
        next_followup_at: null,
        next_followup_trigger: null,
      }).eq("id", prospect_id);
    } else if (event) {
      await supabase.from("followup_events").update({ status: "failed", error: `HTTP ${res.status}` }).eq("id", event.id);
    }

    return new Response(JSON.stringify({ ok, response: rj }), { status: ok ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});