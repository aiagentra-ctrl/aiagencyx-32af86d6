# System Health, Firecrawl, Retry Engine, and Inbox/Conversations Fix

## What I verified first (facts, not guesses)

- **Firecrawl is NOT connected to this project.** A Firecrawl connection exists in your workspace, but it shows `linked to project: no`, so no `FIRECRAWL_API_KEY` is injected into backend functions. Every scraping function (`scrape-and-analyze`, `create-demo`, `build-knowledge-base`, `scrape-ecommerce-products`, `scrape-realestate-listings`) silently falls back or fails. This connection is direct-API mode (real `fc-` key), not gateway mode.
- **The data IS in the database.** 38 prospects, 80 inbox messages (35 outgoing replies), 38 prospect_memory rows, 9 chatbot sessions, 28 chatbot messages, 2 followup events. Storage is working.
- **Inbox and Conversations are empty for a permissions reason, not a data reason.** Every relevant table (`prospects`, `inbox_messages`, `chatbot_sessions`, `chatbot_messages`, `inbox_demos`, `pipeline_events`) only has read policies for the `authenticated` role. The admin panel logs in with a hardcoded email/password in `AdminDashboard.tsx` — it never creates a real backend session, so the browser reads as `anon` and every query returns zero rows. That single cause explains both empty pages.
- **Memory is written but only partly read.** `prospect_memory` is written on reply and used by `inbox-generate-reply` and `followup-generate`, but classification and follow-up scheduling do not consistently receive the full thread + prior replies + status history.
- **There is no failure/retry store.** Demo generation runs as one shot; a Firecrawl or API failure loses all partial work with nothing recorded per step.

## What will be built

### 1. Connect Firecrawl and make it mandatory
- Link the existing Firecrawl connection to this project so `FIRECRAWL_API_KEY` is available in backend functions.
- Add a shared Firecrawl client used by all scraping functions: direct API (`api.firecrawl.dev/v2`), consistent error surfacing (status + body), credit/402 handling.
- **Hard gate:** demo generation refuses to start if Firecrawl is unreachable or out of credits. It records a failed job instead of building a broken demo.

### 2. Real admin authentication (fixes Inbox + Conversations)
- Replace the hardcoded client-side password with real Cloud auth (email/password sign-in) plus an `admin` role in a separate `user_roles` table, checked by a security-definer function.
- Existing table policies then work as intended and Inbox, Conversations, Leads, Follow-Ups, Logs and Tracking all populate from the same stored data.
- Your existing admin email is seeded as the admin user; you set the password once at first sign-in.

### 3. Job + step tracking with resumable retry
New tables:
- `demo_jobs` — one row per demo build: prospect/lead, status (`pending`/`running`/`partial`/`failed`/`completed`), attempt count, last error, created/updated.
- `demo_job_steps` — one row per step (`firecrawl_scrape`, `analyze`, `build_kb`, `create_chatbot`, `create_voice_agent`, `create_demo_page`, `send_reply`): status, output payload, error text, duration, attempt.

Behaviour:
- Each step writes its result before the next starts, so completed work is never lost.
- A retry action re-runs only steps that are `failed` or `pending`, reusing stored output from completed steps.
- Failures appear in Health and Logs with step name, error text and a Retry button.

### 4. Expanded System Health page
The existing 7-step check is extended into grouped checks:
- **Integrations:** Firecrawl (live scrape ping + credits), OpenRouter/Lovable AI, VAPI, ManyReach, Netlify.
- **Limits:** rate-limit / credit signals returned by each provider, plus recent 429/402 counts from logs.
- **Pipeline:** webhook reachable, message stored, classification, memory read/write, reply generated, reply stored, follow-up scheduled.
- **Data sync:** counts of prospects / inbox messages / chatbot sessions visible to the signed-in dashboard user versus actual table counts — this immediately catches any future permissions mismatch.
- **Failures:** open failed demo jobs and failed steps, with retry.

### 5. Memory and history actually used
- Classification receives the full cleaned thread, prior classifications, lead status and demo-sent flag.
- Reply generation and follow-up generation receive the same memory block (already partially present) plus outgoing reply history to prevent repetition.
- Health verifies for a sample lead that memory was read (a pipeline event is recorded for `memory_read`), not just written.

## Technical notes

- Migrations add `demo_jobs`, `demo_job_steps`, `user_roles` + `app_role` enum + `has_role()`, each with explicit GRANTs and RLS.
- New shared modules: `_shared/firecrawl.ts`, `_shared/jobs.ts` (start/step/complete/retry helpers).
- Edge functions changed: `create-demo`, `create-ai-system`, `scrape-and-analyze`, `build-knowledge-base`, `run-health-check`, `inbox-classify`, `inbox-generate-reply`, plus a new `retry-demo-job`.
- Frontend: new `Auth` page/guard, `HealthCheckTab` rebuilt into grouped sections, Logs page gains a failed-jobs view.

## Alternative if you don't want a login

If you prefer keeping the panel password-only with no real sign-in, the other option is to route every dashboard read through service-role edge functions instead of direct table queries. It works but is more code, slower, and weaker security. Tell me if you want that instead — otherwise I'll implement real auth as above.
