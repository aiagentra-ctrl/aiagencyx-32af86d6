/**
 * book_appointment — creates the real Google Calendar event and sends the
 * real confirmation email through Gmail. Falls back to demo mode only when a
 * connection is missing or the provider call fails; the response always states
 * exactly what really happened so the agent never over-claims.
 */
import {
  corsHeaders, admin, calendarApi, calendarReady, gmailReady, loadConfig,
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
    const street = String(args.street_address || args.address || "").trim();
    const city = String(args.city || "").trim();
    const state = String(args.state || "").trim();
    const zip = String(args.zip || args.zip_code || "").trim();
    const projectDetail = String(args.project_detail || "").trim();
    const startIso = String(args.start_iso || args.start || "").trim();
    const endIso = String(args.end_iso || args.end || "").trim();
    const slotLabel = String(args.slot_label || args.date_time || "").trim();
    const calendarId = String(args.calendar || "").trim();
    const timezone = String(args.timezone || "").trim();
    const market = String(args.market || "").trim();
    const estimator = String(args.estimator || "").trim();

    if (!first || !last || !phone || !street || !city || !state || !zip || !projectDetail || !startIso) {
      return toolResponse(toolCallId, {
        status: "failed",
        booked: false,
        message: "Missing required booking details.",
      });
    }

    const cfg = await loadConfig();
    const db = admin();
    const cal = calendarId || cfg.calendar_id || "primary";
    const tz = timezone || cfg.timezone_name || "America/Chicago";
    const company = cfg.company_name || String(metadata?.business_name || "our team");
    const fullAddress = `${street}, ${city}, ${state} ${zip}`;
    const dedupeKey = `${phone}|${startIso}|${zip}`;

    // Idempotency
    const { data: existing } = await db
      .from("agent_appointments").select("id, calendar_event_id, slot_label")
      .eq("dedupe_key", dedupeKey).maybeSingle();
    if (existing) {
      return toolResponse(toolCallId, {
        status: "duplicate",
        booked: true,
        message: "This appointment already exists.",
        slot_label: existing.slot_label || slotLabel,
      });
    }

    let eventId: string | null = null;
    let liveCalendar = false;
    if (calendarReady()) {
      const res = await calendarApi(`/calendars/${encodeURIComponent(cal)}/events`, {
        method: "POST",
        body: JSON.stringify({
          summary: `Free estimate — ${first} ${last} (${projectDetail})`,
          description: [
            `Customer: ${first} ${last}`,
            `Phone: ${phone}`,
            `Email: ${email || "not provided"}`,
            `Address: ${fullAddress}`,
            `Project: ${projectDetail}`,
            market ? `Market: ${market}` : "",
            estimator ? `Estimator: ${estimator}` : "",
          ].filter(Boolean).join("\n"),
          location: fullAddress,
          start: { dateTime: startIso, timeZone: tz },
          end: { dateTime: endIso || new Date(new Date(startIso).getTime() + 3600000).toISOString(), timeZone: tz },
        }),
      });
      if (res.ok) {
        liveCalendar = true;
        eventId = res.body?.id || null;
      } else {
        console.error("calendar insert failed", res.status, res.body);
      }
    }

    // Confirmation email
    let emailSent = false;
    let emailError: string | null = null;
    if (email && gmailReady()) {
      const sent = await sendGmail({
        to: email,
        subject: `Your free estimate with ${company}`,
        body: [
          `Hi ${first},`,
          "",
          `Your free estimate is confirmed for ${slotLabel || startIso}.`,
          `Address: ${fullAddress}`,
          `Project: ${projectDetail}`,
          "",
          "Your estimator will call about 30 minutes before heading your way.",
          "",
          `— ${company}`,
        ].join("\n"),
      });
      emailSent = sent.ok;
      if (!sent.ok) emailError = sent.error ?? null;
    }

    const { data: inserted, error } = await db.from("agent_appointments").insert({
      dedupe_key: dedupeKey,
      chatbot_id: metadata?.chatbot_id || null,
      first_name: first, last_name: last, phone, email: email || null,
      street_address: street, city, state, zip,
      project_detail: projectDetail,
      start_at: startIso,
      end_at: endIso || null,
      slot_label: slotLabel || null,
      market: market || null,
      estimator: estimator || null,
      timezone: tz,
      calendar_id: cal,
      calendar_event_id: eventId,
      mode: liveCalendar ? "live" : "demo",
      email_sent: emailSent,
    }).select("id").maybeSingle();

    if (error && !inserted) {
      console.error("appointment insert failed", error);
      return toolResponse(toolCallId, {
        status: "failed", booked: false,
        message: "The appointment could not be completed.",
      });
    }

    return toolResponse(toolCallId, {
      status: "booked",
      booked: true,
      mode: liveCalendar ? "live" : "demo",
      calendar_event_id: eventId,
      email_confirmation_sent: emailSent,
      email_error: emailError ? "delivery_failed" : null,
      slot_label: slotLabel,
      message: liveCalendar
        ? "Appointment created on the estimator's calendar."
        : "Appointment saved. Calendar sync is unavailable, the office team has the details.",
    });
  } catch (e) {
    console.error("book-appointment error", e);
    return toolResponse(toolCallId, {
      status: "failed", booked: false,
      message: "The appointment could not be completed.",
    });
  }
});
