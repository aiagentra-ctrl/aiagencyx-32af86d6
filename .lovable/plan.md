## What already exists (verified in the code)

| Area | Status today |
|---|---|
| Reply classification | `inbox-classify` edge function returns Positive / Negative / Objection via LLM. Works. |
| Reply templates | A `reply_templates` table exists but is **empty (0 rows)** — replies are currently AI-generated free text, not the two fixed templates you want. |
| Geo lookup | Two different implementations: `track-event` does an ip-api lookup and only treats **Nepal (NP)** as owner traffic; `track-visitor` uses configurable allow/block lists in site settings. No India/Bangladesh/Pakistan exclusion, no "default to tracked" rule. |
| Page tracking | Strong already: session start/end, active time, scroll depth (25/50/75/100%), section enter/leave, click heatmap, return-visit counting, device/browser/OS parsing, bot filtering. |
| Demo engagement duration | **Missing.** No voice-call duration, no chatbot active-time duration, no 1s / 1–5s / 10s+ tier classification anywhere. |
| Follow-up engine | Exists (`followup-evaluator`, `followup-dispatcher`, `followup-send`, `process-follow-up-enrollments`) but is driven by hour-based rules (48h/24h), not by engagement tier or a 3-minute window. |
| Send-time matching | `get_best_send_time` DB function + `prospect_activity_times` already log reply hour/day — reusable for Follow-up 2/3 timing. |
| CTA system | The fixed `cta_type` enum (`link_only` / `demo_only` / `both`) plus auto-appended CTA logic in `_shared/followup.ts` and the Follow-ups UI — this is what gets removed. |
| Tracking dashboard | No dedicated page. Leads panel + Analytics panel exist but there is no per-lead unified timeline and no funnel summary. |

So: page-level tracking and the reply pipeline are largely built; **engagement-duration tiers, the geo rules, the 3-minute trigger, the open message editor and the whole Tracking page are the real work.**

---

## Build plan

### 1. Reply templates (fixed, exact)
- Seed two locked templates keyed to sentiment, rendered verbatim with no added greeting/sign-off:
  - Negative → `{DemoLink}, but... this is done specially for you.`
  - Positive → `Here you go: {DemoLink}` + blank line + `Let me know what you think about it.`
- Add a keyword pre-check ("not interested", "remove me", "unsubscribe", "stop") that short-circuits to Negative before the LLM; everything non-negative → Positive.
- Bypass the current AI reply-format/sign-off enforcement for these two templates so nothing is appended.
- `{DemoLink}` resolves to the lead's own tracked demo URL; sending the reply enrols the lead in tracking.

### 2. Geo filter
- Single shared helper used by every tracking entry point: excluded = NP, IN, BD, PK; tracked = US, CA, AU, GB, NZ + all Europe; **anything else defaults to tracked**.
- Runs first, before any other event write. Excluded opens are still written but flagged `is_self_traffic = true` so they never reach metrics or trigger follow-ups.
- Replaces the NP-only check and unifies the two divergent implementations.

### 3. Engagement duration + tiers
- Voice: record call start/end from the Vapi widget → duration.
- Chatbot: record active in-window time (typing/reading, idle-aware) — reuse the existing active-second tracker.
- Tier: `<1s = not_tried`, `1–5s = tried`, `10s+ = warm`. Stored on the lead record and on each demo-interaction event.

### 4. Follow-up engine rewrite
- **Steps become a queue** (array of ordered steps), not three hardcoded slots.
- Triggers: link opened + no interaction → FU1 *not-tried*; interaction ending with tier tried/warm and no reply within a **3-minute** window → FU1 *tried* / *warm*; no reply to FU1 → FU2; no reply to FU2 → FU3.
- FU2/FU3 scheduled 2–3 days out **at the lead's previously-responsive time-of-day** (via the existing best-send-time data); fallback = time-of-day of the original demo-try/link-open.
- Hard exits: any reply, Calendly booking, or reaching the configurable cap (default: stop after FU3).

### 5. Open message editor (removes the CTA system)
- Delete the `cta_type` presets, auto-appended CTA and the locked structure from the sequence editor and the send path.
- Free-text body per step, independently editable, with an insert-at-cursor variable picker: `{{FirstName}}`, `{{CompanyName}}`, `{{DemoLink}}`, `{{VoiceAgentLink}}`, `{{ChatbotLink}}` + other lead fields.
- Missing values fall back to safe defaults — raw `{{ }}` never renders.
- "Add step" appends to the queue without touching existing steps.

### 6. New "Tracking" page (3 views)
Events are captured first, UI second.

New/extended events: time-to-first-interaction, total time on page, section reached + exit section (Hero/Demo/Reveal/Proof/Calendly), device+browser, channel tried, time-to-first-try, duration+tier, chat exchange count / call duration, reveal-section dwell, Calendly scrolled / widget-clicked / booking-completed (three distinct events), time from demo-try to Calendly click, return-visit count + which follow-up drove it.

- **View 1 — Lead List:** table filterable/sortable by temperature (not-tried/tried/warm), country, current sequence step, booked Y/N, last activity.
- **View 2 — Lead Detail / Thread:** one chronological timeline per lead — open → demo try (duration + tier) → FU1 sent (exact message body) → reply → FU2 → Calendly click → booking / sequence state. Every subsystem above writes into this same lead record.
- **View 3 — Funnel Summary:** % opened, % tried (split by channel), % reached Reveal, % reached Calendly, % booked.

Added to the admin sidebar as a new `tracking` nav item.

---

## Technical notes
- New DB columns/tables: engagement tier + duration + reply-hour on the lead record, a self-traffic flag on tracking events, a per-step message table without `cta_type`, and Calendly/booking events. Migrations include GRANTs + RLS.
- Reuses existing infrastructure rather than rebuilding: `link_events`, `prospect_activity_times`, `get_best_send_time`, the dispatcher cron, and the client tracking library.
- The 3-minute window runs on the existing dispatcher schedule, so effective firing granularity depends on the cron interval — I'll tighten the interval so the 3-minute window is honoured closely.

## Sequencing
Geo filter + duration tiers → reply templates → engine rewrite + editor → tracking events → the three dashboard views. Part 2's verification checklist is run after all of it, ending with the single end-to-end test lead.
