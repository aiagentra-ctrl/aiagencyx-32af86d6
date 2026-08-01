# Real Estate Landing Page Fixes + Tracking/Follow-up Repair

## What I verified first

- **Hero copy**: the locked copy is already in the code, but the page passes the database's `hero_title` / `hero_subtitle` into the hero as overrides. For `luxurypropertiesjh` those fields still hold the old generic text ("Your AI Receptionist for luxurypropertiesjh is Ready"), so the stale copy wins.
- **Client Proof**: no video is configured, so the section renders the gray placeholder box.
- **Footer WhatsApp**: already a clickable `wa.me` link, and no client contact details are present. Confirmed working — no change needed.
- **Voice follow-up bug — root cause found**: the page fires a tracking event named `voice_call_started`, but the database trigger that stamps `voice_tried_at` only recognises `voice_start` / `voice_try`. So the voice attempt is recorded in the raw event log but never reaches the lead record. For the test lead `aiagentron@gmail.com` the demo open registered, the voice attempt did not.
- **Second follow-up blocker**: there are zero follow-up rules configured and zero scheduled jobs, so even a correctly detected voice attempt would never produce a follow-up. Nothing is running the evaluator or the sender on a schedule.
- **Self-traffic**: today it is a soft label — events from Nepal/India/Bangladesh/Pakistan are still written to the real events table with a flag, so downstream logic can still act on them.

### **. Hero — copy is wrong, replace entirely (Image 5)**

**Currently live:** "Your AI Receptionist for realestate is Ready" + a long paragraph about "Online real estate marketplace aggregating property listings across New Zealand for buying, renting, and selling."

This is the **old generic template copy** — it never got replaced with the locked version. Replace with exactly:

Eyebrow: AI agent for {{CompanyName}}

Headline: {{FirstName}}, your leads won't wait , will {{CompanyName}}?

Subhead: Every enquiry answered in seconds, day or night. See {{CompanyName}}'s agent answer a real question below.

Buttons: Hear {{CompanyName}}'s Agent / Try {{CompanyName}}'s Agent

Micro: No signup. No install. Speak to it in the next ten seconds.

  


The buttons and layout are actually correct — it's specifically the eyebrow/headline/subhead text that's stale.

### **2. Demo section — too much vertical space (Image 4)**

The "Live Demo" section has excess padding between the subhead and the two cards, and excess internal card padding. Fix:

- Reduce section top/bottom padding by roughly 30-40%
- Tighten spacing between headline → subhead → cards
- Goal: reduce total scroll height of this section without removing any content — same info, tighter layout

**General rule for the whole page:** every section should be as short as it can be while still readable — the current build is too generous with whitespace across the board, making the page feel longer than it needs to be. Audit every section's top/bottom padding, not just this one.

### **3. Reveal / "Behind the Agent" section — replace 3 boxes with a flow diagram (Image 3)**

Current 3 boxes (Never misses / Qualifies for you / Books itself) — **remove these**, replace with a horizontal flow diagram showing the actual pipeline:

Lead Source (Forms, calls, ads)

   → AI Qualification (Budget, intent, fit)

   → CRM Update (Score and route)

   → Follow-up (Email, WhatsApp, voice)

   → Calendar Booking (Human handoff)

   → Dashboard (Visibility and control)

  


Build this as a horizontal step flow (numbered nodes connected by arrows/lines) — matches the "system" positioning better than generic feature cards, and visually reinforces "this is a pipeline, not just a chatbot." On mobile, this flow should stack vertically with connecting lines/arrows pointing down instead of sideways.

### **4. Dashboard section — fix mobile layout (Image 3)**

Works well on laptop/desktop alo need to improve in laptop likre rectangle e widt dashboard ntvertically stlt . On mobile, it's currently taking up too much vertical scroll space because the sidebar + stat cards are stacking awkwardly.

**Fix:** don't try to make the full interactive dashboard responsive on mobile. Instead:

- Show the dashboard as a single contained rectangle/frame (like a browser window screenshot) that fits within the viewport width
- Add a "View Full D ashboard" tap/expand option if someone wants to see it larger — but the default mobile view should be a compact rectangular preview, not a tall vertically-stacked version of the full sidebar+cards layout

### **5. Client Proof section — currently empty, needs real content (Image 2)**

Right now this section is a **gray placeholder box** with text "A walkthrough of the exact system running for a real estate team" — there's actual video. This needs to be built out properly:

- Add a real client video testimonial :- [https://youtu.be/eOAyie0kWGQ?si=WNs5bZynACkxagLv](https://youtu.be/eOAyie0kWGQ?si=WNs5bZynACkxagLv) this vide of video add this prosperity 
- Add this also in side small properly big  a client/project showcase list — you mentioned these examples:
  - Greenfield Real Estate , Flowly System
  - The Captain Network ,Growth System
  - New Eden ,Booking Automation
  - Sanara ,AI Sales Infrastructure review 5 
- Format these as a small logo/name grid or card list ("Trusted by teams like these") rather than just a headline claim
- Reference [aiagentra.com](http://aiagentra.com) somewhere in this section as the proof source/portfolio link

The three checkmark stat lines on the right (Image 2) are good and can stay — but the main video area needs real content, not a placeholder.

### **6. Calendly section — needs better styling (Image 1)**

Currently using Calendly's default light theme, which clashes with the dark section it's embedded in. Fix:

- Style the Calendly embed using their color customization params to match the page (dark background, orange accent) — this was already planned in the build spec, confirm it actually got implemented
- Make sure date/time selection is clean and doesn't feel like an unstyled third-party widget dropped in

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