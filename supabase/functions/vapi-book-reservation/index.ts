/**
 * book_reservation — creates the real Google Calendar event for a table and
 * sends the guest confirmation through Gmail. Falls back to demo mode only
 * when a connection is missing or the provider call fails, and always reports
 * exactly what really happened.
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

    const first = String(args.first_name || args.name || "").trim();
    const last = String(args.last_name || "").trim();
    const phone = String(args.phone || args.callback_number || "").trim();
    const email = String(args.email || "").trim();
    const partySize = Number(args.party_size || args.guests || 0);
    const startIso = String(args.start_iso || args.start || "").trim();
    const endIso = String(args.end_iso || args.end || "").trim();
    const slotLabel = String(args.slot_label || args.date_time || "").trim();
    const seating = String(args.seating_preference || "").trim();
    const requests = String(args.special_requests || args.notes || "").trim();

    if (!first || !phone || !partySize || !startIso) {
      return toolResponse(toolCallId, {
        status: "failed", booked: false,
        message: "Missing details — a name, phone number, party size and a confirmed time are all required.",
      });
    }

    const cfg = await loadConfig();
    const db = admin();
    const cal = cfg.reservation_calendar_id || cfg.calendar_id || "primary";
    const tz = String(args.timezone || cfg.restaurant_timezone || cfg.timezone_name || "America/Chicago");
    const company = cfg.company_name || String(metadata?.business_name || "the restaurant");
    const durationMin = Number(cfg.reservation_duration_min || 90);
    const end = endIso || new Date(new Date(startIso).getTime() + durationMin * 60000).toISOString();
    const dedupeKey = `res|${phone}|${startIso}`;

    const { data: existing } = await db
      .from("agent_appointments").select("id, slot_label")
      .eq("dedupe_key", dedupeKey).maybeSingle();
    if (existing) {
      return toolResponse(toolCallId, {
        status: "duplicate", booked: true,
        slot_label: existing.slot_label || slotLabel,
        message: "That reservation is already on the books.",
      });
    }

    const detail = [
      `Party of ${partySize}`,
      seating ? `Seating: ${seating}` : "",
      requests ? `Requests: ${requests}` : "",
    ].filter(Boolean).join(" · ");

    let eventId: string | null = null;
    let liveCalendar = false;
    if (calendarReady()) {
      const res = await calendarApi(`/calendars/${encodeURIComponent(cal)}/events`, {
        method: "POST",
        body: JSON.stringify({
          summary: `Table for ${partySize} — ${first} ${last}`.trim(),
          description: [
            `Guest: ${first} ${last}`.trim(),
            `Phone: ${phone}`,
            `Email: ${email || "not provided"}`,
            `Party size: ${partySize}`,
            seating ? `Seating: ${seating}` : "",
            requests ? `Special requests: ${requests}` : "",
          ].filter(Boolean).join("\n"),
          start: { dateTime: startIso, timeZone: tz },
          end: { dateTime: end, timeZone: tz },
        }),
      });
      if (res.ok) { liveCalendar = true; eventId = res.body?.id || null; }
      else console.error("reservation calendar insert failed", res.status, res.body);
    }

    let emailSent = false;
    if (email && gmailReady()) {
      const sent = await sendGmail({
        to: email,
        subject: `Your table at ${company}`,
        body: [
          `Hi ${first},`,
          "",
          `Your table for ${partySize} is confirmed for ${slotLabel || startIso}.`,
          seating ? `Seating: ${seating}` : "",
          requests ? `Notes: ${requests}` : "",
          "",
          "If anything changes, just give us a call.",
          "",
          `— ${company}`,
        ].filter(Boolean).join("\n"),
      });
      emailSent = sent.ok;
      if (!sent.ok) console.error("reservation email failed", sent.error);
    }

    const { data: inserted, error } = await db.from("agent_appointments").insert({
      dedupe_key: dedupeKey,
      chatbot_id: metadata?.chatbot_id || null,
      kind: "reservation",
      party_size: partySize,
      first_name: first, last_name: last || "", phone, email: email || null,
      project_detail: detail || `Party of ${partySize}`,
      start_at: startIso,
      end_at: end,
      slot_label: slotLabel || null,
      timezone: tz,
      calendar_id: cal,
      calendar_event_id: eventId,
      mode: liveCalendar ? "live" : "demo",
      email_sent: emailSent,
    }).select("id").maybeSingle();

    if (error && !inserted) {
      console.error("reservation insert failed", error);
      return toolResponse(toolCallId, {
        status: "failed", booked: false,
        message: "The reservation could not be completed.",
      });
    }

    return toolResponse(toolCallId, {
      status: "booked",
      booked: true,
      mode: liveCalendar ? "live" : "demo",
      calendar_event_id: eventId,
      email_confirmation_sent: emailSent,
      slot_label: slotLabel,
      message: liveCalendar
        ? "Reservation added to the restaurant's book."
        : "Reservation saved for the team — the calendar sync is unavailable right now.",
    });
  } catch (e) {
    console.error("book-reservation error", e);
    return toolResponse(toolCallId, {
      status: "failed", booked: false,
      message: "The reservation could not be completed.",
    });
  }
});
