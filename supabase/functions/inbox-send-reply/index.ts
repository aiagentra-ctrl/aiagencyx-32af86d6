// Send a reply via ManyReach and log it as an outgoing message.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logError } from "../_shared/observability.ts";
import { hasDemoUrl, markDemoLinkSent } from "../_shared/memory.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const MANYREACH_KEY = Deno.env.get("MANYREACH_API_KEY")!;
const MANYREACH_URL = "https://api.manyreach.com/api/v2/messages/reply";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { prospect_id, body, subject, classified_by } = await req.json();
    if (!prospect_id || !body) {
      return new Response(JSON.stringify({ error: "prospect_id and body required" }), { status: 400, headers: corsHeaders });
    }

    const { data: prospect } = await supabase.from("prospects").select("*").eq("id", prospect_id).single();
    if (!prospect) return new Response(JSON.stringify({ error: "prospect not found" }), { status: 404, headers: corsHeaders });

    // Use most recent incoming message id to thread the reply
    const { data: lastIncoming } = await supabase
      .from("inbox_messages")
      .select("manyreach_message_id, subject")
      .eq("prospect_id", prospect_id)
      .eq("direction", "incoming")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const messageId = lastIncoming?.manyreach_message_id;
    const finalSubject = subject || (lastIncoming?.subject ? `Re: ${lastIncoming.subject.replace(/^re:\s*/i, "")}` : "Re: your message");

    let manyreachOk = false;
    let manyreachResponse: any = null;
    if (MANYREACH_KEY && messageId) {
      try {
        const r = await fetch(MANYREACH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-Key": MANYREACH_KEY },
          body: JSON.stringify({
            messageId,
            subject: finalSubject,
            body,
            sendAsReply: true,
            fromEmail: prospect.sender_email,
            replyToEmail: prospect.reply_to_email || prospect.sender_email,
          }),
        });
        manyreachResponse = await r.text();
        manyreachOk = r.ok;
        if (!r.ok) {
          console.error("ManyReach reply failed:", r.status, manyreachResponse);
          await logError("send", `ManyReach ${r.status}: ${String(manyreachResponse).slice(0, 500)}`, { prospect_id });
        }
      } catch (err) {
        console.error("ManyReach send error:", err);
        await logError("send", String((err as any)?.message || err), { prospect_id, stack: (err as any)?.stack });
      }
    } else {
      console.warn("ManyReach send skipped: missing key or messageId");
    }

    // Always store the outgoing message (even if send failed, so admin sees the attempt)
    const { data: outMsg, error: insErr } = await supabase.from("inbox_messages").insert({
      prospect_id,
      direction: "outgoing",
      source: "email",
      subject: finalSubject,
      body,
      classified_by: classified_by || "ai",
    }).select("id").single();
    if (insErr) throw insErr;

    await supabase.from("prospects").update({ last_message_at: new Date().toISOString() }).eq("id", prospect_id);

    // Memory: if this outgoing message contained a demo link, lock future
    // sends from including one.
    if (hasDemoUrl(body)) {
      try { await markDemoLinkSent(prospect_id, outMsg.id); } catch (_) { /* noop */ }
    }

    return new Response(JSON.stringify({ ok: manyreachOk, message_id: outMsg.id, manyreach: manyreachResponse }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("inbox-send-reply error:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: corsHeaders });
  }
});
