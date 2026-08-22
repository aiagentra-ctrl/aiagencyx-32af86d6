/**
 * check_reservation_availability — the authority for restaurant table times.
 *
 * Live mode: reads real free/busy from the connected Google Calendar and only
 * offers slots inside the restaurant's service hours.
 * Demo mode: returns realistic slots and says so in `mode`.
 */
import {
  corsHeaders, admin, calendarApi, calendarReady, loadConfig,
  parseToolCall, toolResponse,
} from "../_shared/agent-tools.ts";

const DEFAULT_SERVICE_HOURS = [11, 12, 13, 17, 18, 19, 20, 21];

function tzOffsetMinutes(at: Date, tz: string): number {
  try {
    const p = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(at).reduce<Record<string, string>>((a, x) => {
      if (x.type !== "literal") a[x.type] = x.value;
      return a;
    }, {});
    const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
    return Math.round((asUtc - at.getTime()) / 60000);
  } catch { return 0; }
}

function zoned(dateIso: string, hour: number, minute: number, tz: string): Date {
  const naive = Date.UTC(+dateIso.slice(0, 4), +dateIso.slice(5, 7) - 1, +dateIso.slice(8, 10), hour, minute, 0);
  let g = new Date(naive - tzOffsetMinutes(new Date(naive), tz) * 60000);
  g = new Date(naive - tzOffsetMinutes(g, tz) * 60000);
  return g;
}

function label(d: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: tz,
    }).format(d);
  } catch { return d.toISOString(); }
}

/** "7:30 pm", "19:30", "7pm" → { hour, minute } in 24h, or null. */
function parseTime(input: string): { hour: number; minute: number } | null {
  const s = input.toLowerCase().trim();
  const m = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2] || 0);
  const ap = m[3];
  if (ap === "pm" && hour < 12) hour += 12;
  if (ap === "am" && hour === 12) hour = 0;
  if (!ap && hour <= 11 && hour >= 1) hour += 12; // dinner-first assumption
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

function todayIn(tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
      .format(new Date());
  } catch { return new Date().toISOString().slice(0, 10); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let toolCallId: string | undefined;
  try {
    const body = await req.json();
    const { args, toolCallId: id, metadata } = parseToolCall(body);
    toolCallId = id;

    const partySize = Number(args.party_size || args.guests || 0);
    const requestedDate = String(args.requested_date || args.date || "").trim();
    const requestedTime = String(args.requested_time || args.time || "").trim();
    const seating = String(args.seating_preference || "").trim();

    const cfg = await loadConfig();
    const tz = cfg.restaurant_timezone || cfg.timezone_name || "America/Chicago";
    const calendarId = cfg.reservation_calendar_id || cfg.calendar_id || "primary";
    const maxParty = Number(cfg.max_party_size || 12);
    const durationMin = Number(cfg.reservation_duration_min || 90);
    const maxSlots = Number(cfg.max_slots_offered || 2);
    const serviceHours = (cfg.restaurant_service_hours || "")
      .split(",").map((h) => Number(h.trim())).filter((h) => Number.isFinite(h) && h >= 0 && h <= 23);
    const hours = serviceHours.length ? serviceHours : DEFAULT_SERVICE_HOURS;

    if (!partySize || partySize < 1) {
      return toolResponse(toolCallId, {
        status: "need_more_info", allow_booking: false,
        message: "Ask how many guests will be joining before checking availability.",
      });
    }
    if (partySize > maxParty) {
      return toolResponse(toolCallId, {
        status: "large_party", allow_booking: false,
        message: `Parties over ${maxParty} are handled by the team — collect the details and send an office note.`,
      });
    }

    const date = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : todayIn(tz);
    const asked = requestedTime ? parseTime(requestedTime) : null;

    // Build candidates: the requested time first, then nearest service hours.
    const candidates: { start: Date; end: Date }[] = [];
    const push = (h: number, m: number) => {
      const start = zoned(date, h, m, tz);
      if (start.getTime() < Date.now() + 30 * 60000) return;
      candidates.push({ start, end: new Date(start.getTime() + durationMin * 60000) });
    };
    if (asked) push(asked.hour, asked.minute);
    const anchor = asked?.hour ?? 19;
    for (const h of [...hours].sort((a, b) => Math.abs(a - anchor) - Math.abs(b - anchor))) {
      push(h, 0);
      if (candidates.length >= 8) break;
    }
    // Nothing left today → roll to tomorrow's service hours.
    if (candidates.length === 0) {
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      for (const h of hours) {
        const start = zoned(tomorrow, h, 0, tz);
        candidates.push({ start, end: new Date(start.getTime() + durationMin * 60000) });
        if (candidates.length >= 6) break;
      }
    }

    let live = false;
    let open = candidates;
    if (calendarReady() && candidates.length) {
      const sorted = [...candidates].sort((a, b) => a.start.getTime() - b.start.getTime());
      const fb = await calendarApi("/freeBusy", {
        method: "POST",
        body: JSON.stringify({
          timeMin: sorted[0].start.toISOString(),
          timeMax: sorted[sorted.length - 1].end.toISOString(),
          timeZone: tz,
          items: [{ id: calendarId }],
        }),
      });
      if (fb.ok) {
        live = true;
        const busy: { start: string; end: string }[] = fb.body?.calendars?.[calendarId]?.busy || [];
        // A restaurant seats several tables at once: only block a slot when the
        // configured concurrent-table limit is already taken.
        const capacity = Number(cfg.concurrent_tables || 6);
        open = candidates.filter((c) => {
          const overlaps = busy.filter((b) =>
            c.start.getTime() < new Date(b.end).getTime() && c.end.getTime() > new Date(b.start).getTime());
          return overlaps.length < capacity;
        });
      } else {
        console.warn("freeBusy failed for reservations", fb.status);
      }
    }

    const slots = open.slice(0, Math.max(maxSlots, 2)).map((c) => ({
      start_iso: c.start.toISOString(),
      end_iso: c.end.toISOString(),
      label: label(c.start, tz),
    }));

    try {
      await admin().from("agent_tool_events").insert({
        tool: "check_reservation_availability",
        mode: live ? "live" : "demo",
        chatbot_id: metadata?.chatbot_id || null,
        payload: { party_size: partySize, requested_date: date, requested_time: requestedTime, seating },
        result: { slots: slots.length },
      });
    } catch { /* non critical */ }

    if (slots.length === 0) {
      return toolResponse(toolCallId, {
        status: "no_slots", allow_booking: false, timezone: tz, mode: live ? "live" : "demo",
        message: "Nothing is open for that request. Offer another day or take a note for the team.",
      });
    }

    return toolResponse(toolCallId, {
      status: "available",
      allow_booking: true,
      timezone: tz,
      party_size: partySize,
      mode: live ? "live" : "demo",
      slots,
    });
  } catch (e) {
    console.error("check-reservation error", e);
    return toolResponse(toolCallId, {
      status: "manual_review", allow_booking: false,
      message: "Availability could not be checked. Take the guest's details and send an office note.",
    });
  }
});
