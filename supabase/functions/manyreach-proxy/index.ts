// Admin-facing ManyReach console: ping, catalog reads and test sends.
// Every call goes through the hardened shared client (retries + webhook_logs).
import { manyreachRequest, manyreachPing, manyreachConfigured, sendReply } from "../_shared/manyreach.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { action, path, method, body, account_id, mailbox_email } = await req.json();
    const routing = { accountId: account_id ?? null, mailboxEmail: mailbox_email ?? null, allowInactive: true };

    switch (action) {
      case "status":
        return json({ configured: manyreachConfigured(), ping: await manyreachPing(routing) });
      case "campaigns":
        return json(await manyreachRequest("/campaigns", { method: "GET", routing }));
      case "prospects":
        return json(await manyreachRequest("/prospects", { method: "GET", routing }));
      case "senders":
        return json(await manyreachRequest("/senders", { method: "GET", routing }));
      case "test_reply":
        return json(await sendReply({ ...body, accountId: account_id ?? null, allowInactive: true }));
      case "raw": {
        if (!path || typeof path !== "string") return json({ error: "path required" }, 400);
        return json(await manyreachRequest(path, { method: method || "GET", body, routing }));
      }

      default:
        return json({ error: `unknown action: ${action}` }, 400);
    }
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
