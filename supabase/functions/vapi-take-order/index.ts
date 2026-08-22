/**
 * place_order — sends a finished food order to the kitchen inbox via Gmail and
 * always records it, so a demo-mode order is still a real, retrievable outcome.
 * No payment details are ever accepted or stored.
 */
import {
  corsHeaders, admin, gmailReady, loadConfig,
  parseToolCall, toolResponse, sendGmail,
} from "../_shared/agent-tools.ts";

type Item = { name: string; quantity?: number; price?: string; notes?: string };

function parseMoney(v: unknown): number {
  const n = Number(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let toolCallId: string | undefined;
  try {
    const body = await req.json();
    const { args, toolCallId: id, metadata } = parseToolCall(body);
    toolCallId = id;

    const first = String(args.first_name || args.name || "").trim();
    const phone = String(args.phone || args.callback_number || "").trim();
    const email = String(args.email || "").trim();
    const fulfilment = String(args.fulfilment || args.fulfillment || "pickup").toLowerCase() === "delivery"
      ? "delivery" : "pickup";
    const address = String(args.delivery_address || args.address || "").trim();
    const requestedTime = String(args.requested_time || "as soon as possible").trim();
    const orderNotes = String(args.order_notes || "").trim();

    let items: Item[] = Array.isArray(args.items) ? args.items : [];
    items = items.filter((i) => i && String(i.name || "").trim());

    if (!phone) {
      return toolResponse(toolCallId, {
        status: "need_more_info", placed: false,
        message: "A phone number is required before the order can go to the kitchen.",
      });
    }
    if (items.length === 0) {
      return toolResponse(toolCallId, {
        status: "need_more_info", placed: false,
        message: "No items captured yet — read the order back and confirm the items first.",
      });
    }
    if (fulfilment === "delivery" && !address) {
      return toolResponse(toolCallId, {
        status: "need_more_info", placed: false,
        message: "A delivery address is required for delivery orders.",
      });
    }

    const cfg = await loadConfig();
    const company = cfg.company_name || String(metadata?.business_name || "the restaurant");
    const kitchenEmail = String(args.office_email || "").trim() || cfg.kitchen_email || cfg.office_email || "";
    const prepMinutes = Number(fulfilment === "delivery"
      ? (cfg.delivery_eta_min || 45)
      : (cfg.pickup_eta_min || 20));

    const total = items.reduce((sum, i) => sum + parseMoney(i.price) * Number(i.quantity || 1), 0);
    const lines = items.map((i) =>
      `- ${i.quantity || 1}× ${i.name}${i.price ? ` (${i.price})` : ""}${i.notes ? ` — ${i.notes}` : ""}`);

    const noteBody = [
      `New ${fulfilment} order taken by the phone assistant for ${company}.`,
      "",
      `Customer: ${first || "not given"}`,
      `Phone: ${phone}`,
      email ? `Email: ${email}` : "",
      fulfilment === "delivery" ? `Delivery address: ${address}` : "Pickup at the counter",
      `Requested for: ${requestedTime}`,
      "",
      "Order:",
      ...lines,
      total > 0 ? `\nApproximate total: ${total.toFixed(2)}` : "",
      orderNotes ? `\nNotes: ${orderNotes}` : "",
    ].filter(Boolean).join("\n");

    let sent = false;
    if (kitchenEmail && gmailReady()) {
      const res = await sendGmail({
        to: kitchenEmail,
        subject: `${fulfilment === "delivery" ? "Delivery" : "Pickup"} order — ${first || phone}`.slice(0, 120),
        body: noteBody,
      });
      sent = res.ok;
      if (!res.ok) console.error("order email failed", res.error);
    }

    if (email && gmailReady()) {
      await sendGmail({
        to: email,
        subject: `Your order from ${company}`,
        body: [
          `Hi ${first || "there"},`,
          "",
          `We've got your ${fulfilment} order:`,
          ...lines,
          total > 0 ? `\nApproximate total: ${total.toFixed(2)}` : "",
          fulfilment === "delivery" ? `\nDelivering to: ${address}` : "\nReady at the counter for pickup.",
          `Estimated ready time: about ${prepMinutes} minutes.`,
          "",
          `— ${company}`,
        ].filter(Boolean).join("\n"),
      }).catch(() => null);
    }

    try {
      await admin().from("agent_office_notes").insert({
        chatbot_id: metadata?.chatbot_id || null,
        first_name: first || null,
        phone, email: email || null,
        address: fulfilment === "delivery" ? address : null,
        project_detail: `${fulfilment} order: ${items.map((i) => `${i.quantity || 1}× ${i.name}`).join(", ")}`.slice(0, 500),
        reason: "food_order",
        next_step: `Prepare for ${requestedTime}`,
        delivered: sent,
        mode: sent ? "live" : "demo",
        body: noteBody,
      });
    } catch (e) { console.warn("order log failed", e); }

    try {
      await admin().from("agent_tool_events").insert({
        tool: "place_order",
        mode: sent ? "live" : "demo",
        chatbot_id: metadata?.chatbot_id || null,
        payload: { fulfilment, items, requested_time: requestedTime },
        result: { emailed: sent, total },
      });
    } catch { /* non critical */ }

    return toolResponse(toolCallId, {
      status: "placed",
      placed: true,
      mode: sent ? "live" : "demo",
      fulfilment,
      approximate_total: total > 0 ? total.toFixed(2) : null,
      ready_in_minutes: prepMinutes,
      message: sent
        ? `Order sent to the kitchen. Tell the customer it'll be about ${prepMinutes} minutes.`
        : `Order saved for the kitchen team. Tell the customer it'll be about ${prepMinutes} minutes.`,
    });
  } catch (e) {
    console.error("take-order error", e);
    return toolResponse(toolCallId, {
      status: "failed", placed: false,
      message: "The order could not be sent. Take a callback number and send an office note.",
    });
  }
});
