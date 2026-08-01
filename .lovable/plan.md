# Real Estate Landing Page Fixes + Tracking/Follow-up Repair

## What I verified first

- **Hero copy**: the locked copy is already in the code, but the page passes the database's `hero_title` / `hero_subtitle` into the hero as overrides. For `luxurypropertiesjh` those fields still hold the old generic text ("Your AI Receptionist for luxurypropertiesjh is Ready"), so the stale copy wins.
- **Client Proof**: no video is configured, so the section renders the gray placeholder box.
- **Footer WhatsApp**: already a clickable `wa.me` link, and no client contact details are present. Confirmed working — no change needed.
- **Voice follow-up bug — root cause found**: the page fires a tracking event named `voice_call_started`, but the database trigger that stamps `voice_tried_at` only recognises `voice_start` / `voice_try`. So the voice attempt is recorded in the raw event log but never reaches the lead record. For the test lead `aiagentron@gmail.com` the demo open registered, the voice attempt did not.
- **Second follow-up blocker**: there are zero follow-up rules configured and zero scheduled jobs, so even a correctly detected voice attempt would never produce a follow-up. Nothing is running the evaluator or the sender on a schedule.
- **Self-traffic**: today it is a soft label — events from Nepal/India/Bangladesh/Pakistan are still written to the real events table with a flag, so downstream logic can still act on them.

## Part 1 — Landing page

1. **Hero copy** — stop letting generic database copy override the locked hero. Locked eyebrow/headline/subhead/buttons/micro-line always render; a database headline is only used if it is genuinely custom (not the auto-generated template string).
2. **Spacing audit** — reduce top/bottom padding roughly 30–40% across every section, tighten headline → subhead → content gaps, and reduce internal card padding in the Demo section. No content removed.
3. **Reveal section** — replace the three feature boxes with a numbered horizontal pipeline flow: Lead Source → AI Qualification → CRM Update → Follow-up → Calendar Booking → Dashboard. Connected by arrows; stacks vertically with downward arrows on mobile.
4. **Dashboard** — desktop/laptop: force a wide rectangular browser-frame aspect so it never renders tall and narrow. Mobile: render a single compact scaled-down rectangle preview (non-interactive) plus a "View Full Dashboard" button that opens it full-screen.
5. **Client Proof rebuild**:
   - Real testimonial video embedded (`eOAyie0kWGQ`).
   - "Trusted by teams like these" card grid: Greenfield Real Estate (Flowly System), The Captain Network (Growth System), New Eden (Booking Automation), Sanara (AI Sales Infrastructure, 5-star).
   - Link to aiagentra.com as the portfolio/proof source.
   - Keep the three checkmark outcome lines.
6. **Calendly** — apply Calendly's colour parameters (dark background `0B0F14`, light text, orange `F97316` accent) and wrap the embed in a framed card so it reads as part of the page.
7. **Footer** — no change needed (verified correct).

## Part 2 — Self-traffic hard gate

Convert the soft flag into a blocking gate applied independently at every tracking entry point (page open, voice try, chat try, scroll, Calendly click, session end):

```text
resolve country -> if NP / IN / BD / PK:
    write to self_traffic_log (separate QA table) and return
    no lead event, no temperature change, no follow-up
else:
    normal tracking
```

The gate runs at the top of each tracking function before any insert, and the lead-updating database trigger also refuses self-traffic rows as a second line of defence.

## Part 3 — Follow-up engine repair

1. **Fix the event-name mismatch** so `voice_call_started` / `chat_started` (and the existing aliases) all stamp `voice_tried_at` / `chatbot_tried_at`, and backfill the test lead's missed voice attempt.
2. **Seed the follow-up rules** that are currently missing, including the short post-voice-try window described in the brief.
3. **Schedule the evaluator and sender** so pending follow-ups actually leave the system on their own.
4. **Send one follow-up to the test lead now** so you can see the real rendered message, and report the delivery result back.
5. **Leads page history** — surface the demo-sent record, tracked link events, and follow-up events for a lead in one timeline, so activity like this is visible instead of silent.

## Technical notes

- Files touched: `REHero`, `REDemo`, `REReveal` (new flow diagram), `REDashboard` (+ mobile preview/modal), `REProof`, `RECalendly`, `RealEstateLandingPage`, `src/pages/DemoPage.tsx`, `src/index.css` spacing tokens.
- Backend: `track-event`, `track-visitor`, `track-chat-event`, `_shared/geo.ts`, the `on_link_event_track_prospect` trigger function, plus migrations for the self-traffic log table and follow-up rule seeds.
- Scheduling uses the database's built-in job scheduler calling the existing evaluator/dispatcher functions.
