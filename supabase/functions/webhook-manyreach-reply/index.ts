// Public webhook for ManyReach reply events (legacy long URL).
// Accepts ?key= / ?secret= / x-webhook-key — unchanged, fully backward compatible.
// The short equivalent is /functions/v1/mr/<token>.
import { corsHeaders, handleManyreachWebhook } from "../_shared/manyreach-webhook.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return handleManyreachWebhook(req, { endpoint: "webhook-manyreach-reply" });
});
