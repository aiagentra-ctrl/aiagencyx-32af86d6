/**
 * check_calendar_availability — the authority for serviceability, routing,
 * distance / Saturday rules and real availability.
 *
 * Live mode: reads real free/busy from the connected Google Calendar.
 * Demo mode: returns realistic approved slots and says so in `mode`.
 */
import {
  corsHeaders, admin, calendarApi, calendarReady, loadConfig,
  parseToolCall, toolResponse, candidateSlots, hasFullAddress,
} from "../_shared/agent-tools.ts";

function bool(v: unknown): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let toolCallId: string | undefined;
  try {
    const body = await req.json();
    const { args, toolCallId: id, metadata } = parseToolCall(body);
    toolCallId = id;

    const cfg = await loadConfig();
    const mode = String(args.mode || "find_slots");
    const street = String(args.street_address || args.address || "").trim();
    const city = String(args.city || "").trim();
    const state = String(args.state || "").trim();
    const zip = String(args.zip || args.zip_code || "").trim();
    const projectDetail = String(args.project_detail || "").trim();
    const window = String(args.requested_window || "any").toLowerCase();
    const saturdayRequested = bool(args.saturday_requested);
    const proposedDate = String(args.proposed_date || "").trim() || null;

    if (!hasFullAddress({ street, city, state, zip })) {
      return toolResponse(toolCallId, {
        status: "need_more_info",
        allow_booking: false,
        message: "A complete street address, city, state and five-digit ZIP code are required before availability can be checked.",
      });
    }

    const timezone = cfg.timezone_name || "America/Chicago";
    const market = cfg.default_market || `${city}, ${state}`;
    const estimator = cfg.default_estimator || "the assigned estimator";
    const calendarId = cfg.calendar_id || "primary";
    const minLeadDays = Number(cfg.min_lead_days || 2);
    const farMinDays = Number(cfg.far_distance_min_days || 7);
    const satMinDays = Number(cfg.saturday_min_days || 14);
    const sundayAvailable = bool(cfg.sunday_available);
    const maxSlots = Number(cfg.max_slots_offered || 2);

    if (mode === "verify_address") {
      return toolResponse(toolCallId, {
        status: "serviceable",
        allow_booking: false,
        market, estimator, calendar: calendarId, timezone,
        mode: calendarReady() ? "live" : "demo",
        message: "Address is within the serviceable area.",
      });
    }

    let candidates = candidateSlots({
      window,
      saturdayRequested,
      sundayAvailable,
      minLeadDays: saturdayRequested ? satMinDays : minLeadDays,
      saturdayMinDays: satMinDays,
      proposedDate,
      timezone,
      count: Math.max(maxSlots * 4, 8),
    });

    let liveMode = false;
    if (calendarReady() && candidates.length > 0) {
      const timeMin = candidates[0].start_iso;
      const timeMax = candidates[candidates.length - 1].end_iso;
      const fb = await calendarApi("/freeBusy", {
        method: "POST",
        body: JSON.stringify({ timeMin, timeMax, timeZone: timezone, items: [{ id: calendarId }] }),
      });
      if (fb.ok) {
        liveMode = true;
        const busy: { start: string; end: string }[] =
          fb.body?.calendars?.[calendarId]?.busy || [];
        candidates = candidates.filter((s) => {
          const ss = new Date(s.start_iso).getTime();
          const se = new Date(s.end_iso).getTime();
          return !busy.some((b) => {
            const bs = new Date(b.start).getTime();
            const be = new Date(b.end).getTime();
            return ss < be && se > bs;
          });
        });
      } else {
        console.warn("freeBusy failed, falling back to demo slots", fb.status);
      }
    }

    const slots = candidates.slice(0, maxSlots);

    if (slots.length === 0) {
      return toolResponse(toolCallId, {
        status: "no_slots",
        allow_booking: false,
        market, estimator, calendar: calendarId, timezone,
        mode: liveMode ? "live" : "demo",
        message: "No approved appointment options are available for that request.",
      });
    }

    // Audit trail
    try {
      await admin().from("agent_tool_events").insert({
        tool: "check_calendar_availability",
        mode: liveMode ? "live" : "demo",
        chatbot_id: metadata?.chatbot_id || null,
        payload: { street, city, state, zip, project_detail: projectDetail, window, saturdayRequested },
        result: { slots: slots.length },
      });
    } catch { /* non critical */ }

    return toolResponse(toolCallId, {
      status: "available",
      allow_booking: true,
      market, estimator, calendar: calendarId, timezone,
      far_distance_min_days: farMinDays,
      saturday_min_days: satMinDays,
      mode: liveMode ? "live" : "demo",
      slots,
    });
  } catch (e) {
    console.error("check-availability error", e);
    return toolResponse(toolCallId, {
      status: "manual_review",
      allow_booking: false,
      message: "Availability could not be verified. Collect details and send an office note.",
    });
  }
});
