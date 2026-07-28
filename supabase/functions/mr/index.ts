// Short ManyReach webhook: POST /functions/v1/mr/<token>
// Same behaviour as webhook-manyreach-reply, just a clean URL with the secret
// carried in the path instead of a query string.
import { corsHeaders, handleManyreachWebhook } from "../_shared/manyreach-webhook.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // /functions/v1/mr/<token>  →  token is the last path segment
  const segments = new URL(req.url).pathname.split("/").filter(Boolean);
  const idx = segments.lastIndexOf("mr");
  const token = idx >= 0 && segments.length > idx + 1 ? decodeURIComponent(segments[idx + 1]) : null;

  return handleManyreachWebhook(req, { endpoint: "mr", secretOverride: token });
});