# Funnel fixes, lead thread view, speed, and chatbot separation

Six work items, grouped. Verified current state first — notes on what is actually true are in each section.

## 1. "Any agent tried" trigger

Today the evaluator only branches on `tried_voice_only` and `tried_chat_only` (confirmed in the evaluator and in the sequence trigger dropdown). A lead who tried either channel has the same intent.

- Add a new rule/trigger `tried_any_agent`: fires when voice OR chat was tried and the wait window has passed.
- Priority: `tried_any_agent` is checked before the voice-only/chat-only branches, so one sequence covers both. Voice-only/chat-only stay available for teams that want channel-specific copy.
- Add it to the sequence trigger dropdown and to the default follow-up message library.
- Seed the rule (enabled, 48h default) so it works without manual setup.

## 2. Lead detail / thread view — full message + reply log

The Tracking page currently has only the Lead List and Funnel Summary; there is no per-lead thread. The old Leads detail view exists but reads a different, legacy table and does not show sequence emails or inbound replies.

Build a real single-thread lead detail (opened by clicking a row in Tracking):

- Header: name, company, email, country, temperature, sequence step, booked status.
- One chronological timeline merging: link opens, scroll/reveal reach, demo tries (voice/chat with duration), Calendly clicks/bookings, every follow-up sent (exact resolved copy + subject + timestamp), and every inbound reply with its text and sentiment classification.
- Sequence status badge: Active / Replied-stop / Booked-stop / Completed.

## 3. Sequence not stopping after a reply (critical)

The processor does check for replies, but only for messages newer than `enr.started_at`, and only at the moment a step is due. There is also a DB trigger that marks enrollments responded on incoming mail. Cause to confirm and fix:

- Make the reply stop unconditional and immediate: on any incoming message for a prospect, cancel every active/sending/pending item for that lead — enrollments, `followup_events` still pending, and `prospects.next_followup_at`.
- Reply-check in the processor should look at "any incoming message at all", not only after `started_at`, and should also block the rule-based evaluator from creating new events.
- Same hard stop for a Calendly booking.
- Backfill: cancel any currently-scheduled follow-ups for leads who have already replied.

## 4. Page load speed (target: under 1s)

Current demo page does a serial fetch: page row → then settings + chatbot → then render, plus lazy chunks and tracking calls on mount.

- Collapse the initial data fetch into one parallel round-trip and render the hero from the first response instead of waiting for chatbot/settings.
- Preload the landing chunk and fonts; defer tracking, Calendly, YouTube, and chat widget until idle/interaction.
- Compress and size the dashboard/proof imagery; drop render-blocking work above the fold.
- Measure before/after with a scripted Lighthouse-style run and report the numbers.

## 5. VAPI connection speed and reliability

Currently `@vapi-ai/web` is dynamically imported only when the user clicks, so the SDK download happens inside the click, then `vapi.start()` runs — that is the main delay.

- Warm up: preload the VAPI SDK and construct the client on idle after page load (or on hover/viewport of the demo section), so the click only calls `start()`.
- Request mic permission at click and show immediate connecting feedback with a visible state machine.
- Add error/`error` event handling with a retry, and log failures so silent drop-offs are visible.
- Test repeatedly, including a throttled mobile-network profile, and report connect times across runs.

## 6. Chatbot UI + voice/chat separation + reply quality

- **Separation:** the real-estate page passes the same handlers around; the voice button must only start the call UI and never open the chat window. Audit every "Try Voice Agent" entry point (hero, demo section, sticky button) and confirm each is wired to the call flow only.
- **Chatbot UI:** rebuild the real-estate chat widget to match the e-commerce chat UI already in this project (`EcomFloatingChatWidget` / `EcomChatShell` / `UnifiedChatWindow`) — same layout, bubbles, input, header, suggestion chips. Voice UI untouched.
- **Reply quality:** tighten the real-estate system prompt so answers are specific, human, and complete; test against the sample buyer prompts on the page.

## Technical notes

- New migration: seed `tried_any_agent` rule; update the link-event/inbox triggers to cancel scheduled follow-ups on any inbound message.
- Edge functions touched: `followup-evaluator`, `process-follow-up-enrollments`, `followup-dispatcher`, `chatbot-conversation`.
- Frontend touched: `TrackingPage` (+ new lead thread component), `FollowUpsPage` (trigger option), `DemoPage` (fetch/VAPI warm-up), real-estate chat widget.

## Confirmation needed

For the e-commerce chatbot UI reference, I will copy this project's own e-commerce widget (`EcomFloatingChatWidget` / `EcomChatShell`) unless you meant an external site.
