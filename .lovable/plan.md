# Fix duplicate demos/replies + owner (self-traffic) detection

## What I found

**1. Firecrawl is NOT working.** The scraper looks for a Firecrawl key in two places: the API Providers table and a `FIRECRAWL_API_KEY` secret. Both are empty — there are zero provider rows and no Firecrawl secret saved. There are also zero Firecrawl activity log entries ever. So every demo built right now is created without real website research (fallback content only).

**2. Liam Duffy got two demos and two replies — confirmed root cause.** ManyReach sent two separate webhook events for the *same* reply, 2.8 seconds apart:
- `prospect_replied` at 12:27:10
- `prospect_interested` at 12:27:12

Both carried the identical ManyReach message ID. Nothing in the system deduplicates on that ID, so two parallel pipelines ran. Because they overlapped, neither saw the other's demo record, and both built a demo and sent a reply:
- `.../tropos-ar` sent 12:27:36
- `.../tropos-ar-rff6` sent 12:27:38

This will repeat for every "interested" lead — it is systematic, not a one-off.

**3. Self-traffic detection is thin.** Today the only owner signal is country (NP/IN/BD/PK) from an IP lookup, plus an optional blocked-IP list that is currently empty. There is no way to mark yourself as the owner from the admin panel, and if the IP lookup fails the visit counts as a real client (correct default, but with no second signal to catch you).

## What to build

### A. Stop duplicate demos and duplicate replies (highest priority)
- Make the incoming ManyReach message ID unique in the database, so a repeat delivery of the same message can never create a second inbox record.
- The webhook detects the duplicate, stores it as a log-only event, and returns without starting the pipeline a second time.
- Add a second safety net in the orchestrator: a short-lived per-lead processing lock, so two pipelines for the same lead can never run at the same time even if the IDs differ.
- Add a hard rule before any demo build: if this lead already has a demo, reuse it — never build a new one.
- Add a hard rule before sending: if an outgoing reply was already sent to this lead in the last few minutes, hold instead of sending.

### B. Firecrawl
- Confirm with you whether you want Firecrawl connected (see question below). Once connected, the existing scraper works unchanged; I'll run a live test scrape and show the result.

### C. Owner / self-traffic detection
- Add an "Owner & test traffic" section in admin settings where you can save: your IP addresses, owner countries (pre-filled NP/IN/BD/PK), and owner email addresses.
- Add a one-click "Mark this device as mine" button in the admin panel. It stores a signed owner marker in your browser, which every tracking call sends along. Any visit with that marker is recorded as self-traffic regardless of country or IP.
- Visiting any demo page while logged into the admin panel is also treated as owner traffic.
- Layered decision, in order: owner device marker → owner IP → owner country → previously-known country for that lead → otherwise treat as a real client and keep normal follow-up running.
- Unknown device/location stays a potential client, exactly as you asked. Self-traffic is stored but excluded from lead counts, engagement tiers, follow-up triggers and funnel percentages.

### D. Clean up the Liam Duffy record
- Keep one demo link as the canonical one, mark the duplicate demo page and duplicate outgoing message as superseded so the thread and funnel numbers read correctly.

## Technical notes
- Unique index on `inbox_messages.manyreach_message_id` (incoming only), with conflict-aware insert in `_shared/manyreach-webhook.ts`.
- Advisory-style lock row keyed on prospect id, checked in `inbox-process-incoming` before classify/demo/send.
- Demo reuse check moved before `create-demo` and re-checked after, inside the lock.
- New `site_settings` keys: `owner_ips`, `owner_countries`, `owner_emails`; owner device marker in `localStorage` forwarded by `src/lib/tracking.ts`.
- Shared resolver in `supabase/functions/_shared/geo.ts` used by `track-event`, `track-visitor`, and `track-chat-event` so all three paths agree.
