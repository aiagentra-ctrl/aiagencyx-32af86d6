/**
 * log_unbooked_lead — saves a live new-estimate caller who did not book.
 * Deduplicated per phone + project detail so no duplicate records are created.
 */
import {
  corsHeaders, admin, parseToolCall, toolResponse,
} from "../_shared/agent-tools.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let toolCallId: string | undefined;
  try {
    const body = await req.json();
    const { args, toolCallId: id, metadata } = parseToolCall(body);
    toolCallId = id;

    const first = String(args.first_name || "").trim();
    const last = String(args.last_name || "").trim();
    const phone = String(args.phone || args.callback_number || "").trim();
    const email = String(args.email || "").trim();
    const address = String(args.address || args.street_address || "").trim();
    const projectDetail = String(args.project_detail || "").trim();
    const reason = String(args.reason || args.not_booked_reason || "").trim();

    if (!phone && !email) {
      return toolResponse(toolCallId, {
        status: "failed", saved: false,
        message: "A callback number or email is required before saving the lead.",
      });
    }

    const db = admin();
    const dedupeKey = `${phone || email}|${projectDetail}`.toLowerCase();

    const { data: existing } = await db
      .from("agent_unbooked_leads").select("id").eq("dedupe_key", dedupeKey).maybeSingle();
    if (existing) {
      return toolResponse(toolCallId, {
        status: "saved", saved: true, duplicate: true,
        message: "This lead is already saved.",
      });
    }

    const { error } = await db.from("agent_unbooked_leads").insert({
      dedupe_key: dedupeKey,
      chatbot_id: metadata?.chatbot_id || null,
      first_name: first || null, last_name: last || null,
      phone: phone || null, email: email || null,
      address: address || null,
      project_detail: projectDetail || null,
      reason: reason || null,
    });
    if (error) {
      console.error("unbooked lead insert failed", error);
      return toolResponse(toolCallId, {
        status: "failed", saved: false,
        message: "The lead could not be saved.",
      });
    }

    return toolResponse(toolCallId, {
      status: "saved", saved: true, mode: "live",
      message: "Lead saved for future follow-up.",
    });
  } catch (e) {
    console.error("log-unbooked-lead error", e);
    return toolResponse(toolCallId, {
      status: "failed", saved: false,
      message: "The lead could not be saved.",
    });
  }
});
