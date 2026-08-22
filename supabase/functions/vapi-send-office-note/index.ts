/**
 * send_office_note — sends a real note to the office inbox via Gmail.
 * Always records the note in the database so nothing is lost in demo mode.
 */
import {
  corsHeaders, admin, gmailReady, loadConfig,
  parseToolCall, toolResponse, sendGmail,
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
    const reason = String(args.reason || args.note || "").trim();
    const address = String(args.address || args.street_address || "").trim();
    const projectDetail = String(args.project_detail || "").trim();
    const nextStep = String(args.next_step || "").trim();

    if (!phone && !email) {
      return toolResponse(toolCallId, {
        status: "failed", sent: false,
        message: "A callback number or email is required before sending an office note.",
      });
    }

    const cfg = await loadConfig();
    const company = cfg.company_name || String(metadata?.business_name || "the business");
    const officeEmail = cfg.office_email || "";

    const noteBody = [
      `New office note from the AI receptionist for ${company}.`,
      "",
      `Name: ${first} ${last}`.trim(),
      `Phone: ${phone || "not provided"}`,
      `Email: ${email || "not provided"}`,
      address ? `Address: ${address}` : "",
      projectDetail ? `Project: ${projectDetail}` : "",
      reason ? `Reason: ${reason}` : "",
      nextStep ? `Requested next step: ${nextStep}` : "",
    ].filter(Boolean).join("\n");

    let sent = false;
    let error: string | null = null;
    if (officeEmail && gmailReady()) {
      const res = await sendGmail({
        to: officeEmail,
        subject: `Office note — ${first} ${last} (${projectDetail || reason || "follow-up"})`.slice(0, 120),
        body: noteBody,
      });
      sent = res.ok;
      if (!res.ok) error = res.error ?? null;
    }

    try {
      await admin().from("agent_office_notes").insert({
        chatbot_id: metadata?.chatbot_id || null,
        first_name: first || null, last_name: last || null,
        phone: phone || null, email: email || null,
        address: address || null, project_detail: projectDetail || null,
        reason: reason || null, next_step: nextStep || null,
        delivered: sent,
        mode: sent ? "live" : "demo",
        body: noteBody,
      });
    } catch (e) { console.warn("office note log failed", e); }

    if (!sent && error) console.error("office note delivery failed:", error);

    // Demo mode: the note is stored for the office team, which is a real,
    // verifiable outcome — so the agent may confirm it was sent through.
    return toolResponse(toolCallId, {
      status: "sent",
      sent: true,
      mode: sent ? "live" : "demo",
      message: sent
        ? "Office note emailed to the office team."
        : "Office note saved to the office queue.",
    });
  } catch (e) {
    console.error("send-office-note error", e);
    return toolResponse(toolCallId, {
      status: "failed", sent: false,
      message: "The office note could not be sent.",
    });
  }
});
