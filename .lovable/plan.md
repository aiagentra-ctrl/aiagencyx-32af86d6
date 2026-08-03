# Real estate chatbot UI, automation timing, conversation history, page speed

Verified current state first — findings are noted in each section.

## 1. Chatbot UI — real estate version of the e-commerce shell

The widget already uses the e-commerce shell (avatar header, greeting, chip grid, recent conversation, bottom nav, "Powered by" footer). What is still e-commerce specific: the default chips (`Bestsellers / Gifts / Under $100 / Track order`), the FAQ defaults (returns, shipping, gift wrapping, sizes), and the "What are you shopping for today?" tagline fallback. The demo page never passes FAQs, so the shipping/returns FAQ list is what real estate visitors see today.

Changes, keeping the layout untouched:

- Greeting header: `Hi, I'm {{CompanyName}}'s AI` with the sub-line `I've read {{CompanyName}}'s whole site. Ask me about listings, pricing, viewings, or the areas we cover.`
- Avatar: client logo when available, otherwise the client's initials (never generic AI branding).
- Quick pills (replacing the four e-commerce ones): Listings, Book a Viewing, Pricing, Areas We Cover — each with its short descriptor and each sending a real question to the agent.
- Recent conversation example copy follows the real chat when one exists; the empty/illustrative state reads "Book a viewing".
- FAQ list replaced with: price on a listing, 3-bedroom availability, how to book a viewing, areas covered, financing qualification.
- Footer stays "Powered by AI Agentra" (product attribution); everything above it is client-named.

All strings resolve through the same personalization variables the landing page uses, so no `{{CompanyName}}` ever renders raw.

## 2. Follow-up automation — timing and manual steps

Verified:

- Both cron jobs (`followup-evaluator`, `followup-dispatcher`) run every 15 minutes. Worst case from condition met to message sent is ~30 minutes, so the 1-minute requirement is not met today.
- All seven rules have `auto_send = true`, so there is no human approval step in the rule path — the dispatcher sends without anyone clicking.
- The sequence engine (`process-follow-up-enrollments`, which sends follow-ups 2 and 3) has no cron job at all. It only runs when invoked manually. This means later sequence steps are effectively not automatic today.

Fix:

- Run evaluator, dispatcher, and the sequence processor every minute.
- Add the missing schedule for the sequence engine so steps 2/3 hold the same standard as step 1.
- Add a lightweight run log (started/considered/sent per run) so the actual condition-met → sent delay is measurable rather than assumed.
- Then run a real test lead end to end and report the measured delay for step 1 and step 2, plus confirmation that no rule requires a manual send.

## 3. Conversation history — full message-level thread per lead

Today the lead thread shows link events, follow-ups sent, and replies, plus "opened the chatbot"/"tried the voice agent" markers. The actual chatbot transcript lives in separate tables (`chatbot_sessions` / `chatbot_messages` / `chatbot_conversations`) and is not joined into the lead's thread.

Changes:

- Join the lead's chatbot sessions into the thread and render every message — visitor and AI — in order with timestamps.
- Voice calls: show duration, engagement tier, and outcome inline. Transcript is added if the voice provider returns one for the call; if it does not, the plan ships duration/outcome only and says so rather than faking it.
- Follow-ups sent and replies keep their exact resolved text and timestamps.
- Everything merges into the one existing chronological timeline per lead — no second log surface.

## 4. Demo page load speed

The page already fetches its data in parallel and defers tracking, but the target has not been measured. Approach:

- Measure first: scripted load of a real demo URL, cold cache, with a throttled mobile profile (4G, CPU slowdown) and report the current numbers — first contentful paint, largest contentful paint, and time to interactive.
- Fix what the trace names, in likely order: split the below-the-fold sections (Reveal, dashboard, proof video, Calendly, chat widget) out of the initial chunk, compress and correctly size hero/dashboard imagery, and hold third-party embeds until interaction or idle.
- Re-measure with the same script and report before/after numbers side by side.

Honest note: sub-1s LCP on real mobile data is achievable for the hero, but it depends on what the trace shows. If a specific blocker cannot be removed client-side, that is reported with the number rather than glossed over.

## Technical notes

- Frontend: `EcomChatShell.tsx` (real estate defaults + FAQ/chip props), `EcomFloatingChatWidget.tsx`, `DemoPage.tsx` (pass FAQs/chips/greeting), `LeadThreadDialog.tsx` (chatbot transcript + voice detail merge), real estate v2 sections (code splitting).
- Backend: cron schedules for `followup-evaluator`, `followup-dispatcher`, and `process-follow-up-enrollments` at 1-minute intervals; run logging in those functions.
- No schema change is expected for the transcript view — the message tables already exist.
