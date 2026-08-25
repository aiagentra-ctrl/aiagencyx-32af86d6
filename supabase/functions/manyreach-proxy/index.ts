// Admin-facing ManyReach console: ping, catalog reads and test sends.
// Every call goes through the hardened shared client (retries + webhook_logs).
import { manyreachRequest, manyreachPing, sendReply } from "../_shared/manyreach.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { action, path, method, body } = await req.json();
    const accountId = body?.accountId || body?.manyreach_account_id || null;
    const mailboxEmail = body?.mailboxEmail || body?.senderEmail || body?.fromEmail || null;

    switch (action) {
      case "status": {
        const ping = await manyreachPing({ accountId, mailboxEmail });
        return json({ configured: ping.ok, ping });
      }
      case "campaigns":
        return json(await manyreachRequest("/campaigns", { method: "GET" }, { accountId, mailboxEmail }));
      case "prospects":
        return json(await manyreachRequest("/prospects", { method: "GET" }, { accountId, mailboxEmail }));
      case "senders":
        return json(await manyreachRequest("/senders", { method: "GET" }, { accountId, mailboxEmail }));
      case "test_reply":
        return json(await sendReply({
          ...body,
          mailboxEmail,
          accountId,
        }));
      case "raw": {
        if (!path || typeof path !== "string") return json({ error: "path required" }, 400);
        return json(await manyreachRequest(path, { method: method || "GET", body }, { accountId, mailboxEmail }));
      }
      default:
        return json({ error: `unknown action: ${action}` }, 400);
    }
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
