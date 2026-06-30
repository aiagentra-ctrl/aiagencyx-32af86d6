
# Inbox Manager v4 — Parity with n8n Workflow + Health Check Page

Goal: make our in-app inbox behave **exactly** like the supplied n8n workflow (same memory per client, same classify/reply prompts, same APIs), fix the ManyReach 401 error, and add a visual end-to-end "is everything working" page.

---

## Part A — Fix ManyReach 401

Root cause: ManyReach posts with no `Authorization: Bearer <jwt>` header, so Supabase rejects the request before our code runs.

1. `supabase/config.toml` — add a per-function override (only for this one public receiver):
   ```toml
   [functions.webhook-manyreach-reply]
   verify_jwt = false
   ```
2. Keep the existing `?key=<INBOX_WEBHOOK_SECRET>` check inside the function (already implemented) as the real auth — return `401 {"error":"unauthorized"}` on mismatch.
3. Accept the secret under **either** `?key=` or `?secret=` (n8n-style) and via `x-webhook-key` header, so existing wiring and the new spec both work.
4. `WebhookUrlCard` already shows the URL — extend it to (a) include `?secret=…` automatically pulled from a new `get-webhook-url` edge function (server reads `INBOX_WEBHOOK_SECRET`, returns full URL — secret never reaches frontend bundle), (b) add a "Regenerate Secret" button (confirm dialog) that calls `rotate-webhook-secret` edge function to mint a new value and update the Supabase secret.

---

## Part B — 1:1 Parity with n8n JSON

Map every n8n node to our existing edge function / table:

| n8n node | Our equivalent | Change needed |
|---|---|---|
| `Webhook` | `webhook-manyreach-reply` | Accept full ManyReach body shape: `body.prospect.{email,firstname,company,www}`, `body.message`, `body.messageId`, `body.sender_email`, `body.campaign.{campaignID,campaignTitle}` |
| `store webhook massage` (POST /mp-api/webhook/message) | `inbox_messages` insert | Already done; ensure `source` column accepts `email`/`whatsapp` |
| `history` tool (GET /mp-api/chat/history?email=) | new edge function `inbox-history` returning prior `inbox_messages` for that prospect email | Used as a tool by classifier; also exposed to UI |
| `Intent detection` agent + system prompt | `inbox-classify` | **Replace** current prompt with the exact n8n system prompt verbatim, including the `aiagentfor.lovable.app` link-detection rule. Pass `history` (last N msgs) into the prompt. Output must be exactly `Positive` / `Negative` / `Objection` |
| `Switch` on output | `inbox-process-incoming` | Branch on classification |
| `make ai agent + website` (POST /create-demo with prospect fields) | call existing `create-demo` function | For Positive AND Objection branches, call `create-demo` with `business_name`, `website_url`, `firstName`, `campaignName`, `campaignId`, `senderEmail`, `company`, `replyToEmail` → returns `demo_url`. Persist on `prospects.demo_url` keyed by email = **client memory** |
| `Positive Reply Handler` | `inbox-generate-reply` (positive path) | **Replace** system prompt with the exact n8n positive prompt; user prompt = `website url :- " {{ demo_url }} "` |
| `negative reply handle` | `inbox-generate-reply` (negative path) | **Replace** with exact n8n negative prompt (curiosity + single link) |
| Objection branch | `inbox-generate-reply` (objection path) | Use the existing Objection prompt; ensure `demo_url` is injected |
| `reply that email` (POST manyreach /v2/messages/reply) | `inbox-send-reply` | Already calls ManyReach; ensure body uses `messageId`, `subject = "Re: <firstname> overview"`, `body`, `sendAsReply=true`, `fromEmail = sender_email`, `replyToEmail = prospect.email`, header `X-API-Key: MANYREACH_API_KEY` |
| `store reply` (POST /mp-api/ai/reply) | insert outgoing row into `inbox_messages` with `direction='outgoing'` | Already done |

Per-client memory: keep `prospects` keyed by email; cache `demo_url`, `campaign_id`, `sender_email`, `last_message_at`, plus a new `client_memory jsonb` column for free-form per-client context (firstname, company, www, last classification, demo_sent_at). Classifier and reply generator both read it so behavior stays consistent across replies — same as n8n re-using the email's history.

LLM choice: keep Lovable AI Gateway (`google/gemini-2.5-flash` for classify, `google/gemini-2.5-pro` for reply) — matches function of `gpt-4.1-mini` / `o4-mini-high` without needing OpenAI/OpenRouter keys.

---

## Part C — Health Check Page

New table `system_health_checks(id, step_name, status, response_detail jsonb, error_message, duration_ms, tested_at)` with proper GRANTs + RLS (admin read).

New edge function `run-health-check` taking `{ step: "webhook"|"db_write"|"classify"|"create_demo"|"generate_reply"|"manyreach"|"secrets"|"all" }`. Each step inserts a row and returns the result.

Test logic per step:
1. **Webhook** — POST sample payload (email `healthcheck-test@example.com`) to live webhook URL with secret; pass if 200.
2. **DB Write** — query `inbox_messages`/`prospects` for that test email within 3s; pass if found.
3. **Classify** — invoke `inbox-classify` with `"yes I'm interested, send me the link"`; pass if output ∈ {Positive,Negative,Objection}.
4. **Create Demo** — invoke `create-demo` with `Health Check Test Co` / `https://example.com`; pass if `demo_url` non-empty.
5. **Generate Reply** — invoke `inbox-generate-reply` positive path with fake `demo_url`; pass if non-empty text.
6. **ManyReach** — GET ManyReach account/campaigns endpoint with `X-API-Key`; pass if not 401/403. Never sends a real reply.
7. **Secrets** — server-side check `INBOX_WEBHOOK_SECRET`, `LOVABLE_API_KEY`, `MANYREACH_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` exist & non-empty; return checklist (no values).

UI: new tab "Health Check" inside Developer View of `InboxManagerPanel` (no new route, matches existing dashboard nav).
- 7 cards in sequence, each: name, description, status dot (gray/green/red), "Run Test" button, last tested relative time, duration ms, expandable JSON of last response, error in red on fail.
- Top: **Run All Tests** button → sequentially fires steps, updates each card live via streaming (call function per step from frontend so user sees progress card-by-card). Summary banner `X/7 passed` with click-to-scroll on failures. "Tests running…" disables button while in flight; 10s per-step timeout warning.
- Bottom: history table (last 30 rows from `system_health_checks`, newest first).

Test data isolation: add `is_test_data boolean default false` to `prospects` and `inbox_messages`. Webhook recognises the test marker email and sets the flag; existing Inbox/Leads queries filter `is_test_data = false`.

---

## Technical Notes

- **Edge functions added**: `inbox-history`, `get-webhook-url`, `rotate-webhook-secret`, `run-health-check`.
- **Edge functions modified**: `webhook-manyreach-reply` (richer payload mapping, accept `secret` param), `inbox-classify` (new prompt + history tool), `inbox-generate-reply` (n8n-exact prompts), `inbox-process-incoming` (create-demo before reply on Positive/Objection).
- **DB migrations**:
  - `system_health_checks` table (+ GRANT/RLS).
  - `prospects`: add `client_memory jsonb`, `is_test_data boolean`.
  - `inbox_messages`: add `is_test_data boolean`.
- **`supabase/config.toml`**: append `[functions.webhook-manyreach-reply] verify_jwt = false`.
- **Frontend**: new `HealthCheckTab.tsx`, extend `WebhookUrlCard.tsx` with Regenerate, new Developer tab entry in `InboxManagerPanel.tsx`. Existing User View unchanged.
- **Secret rotation**: `rotate-webhook-secret` calls Supabase Management API; if unavailable, falls back to instructing user via toast — confirm before building.

---

## Build Order
1. `config.toml` JWT disable + webhook payload parity fix (unblocks ManyReach 401).
2. Migrations: `system_health_checks`, `is_test_data`, `client_memory`.
3. Edge fns: `inbox-history`, prompt replacements in `inbox-classify` / `inbox-generate-reply`, `create-demo` integration in `inbox-process-incoming`.
4. `get-webhook-url` + WebhookUrlCard with auto-included secret + Regenerate.
5. `run-health-check` edge fn (all 7 steps).
6. `HealthCheckTab` UI + Run All + history log.
7. Filter `is_test_data` out of Inbox/Leads list queries.

One open question before I start: do you want the **Regenerate Secret** button wired to actually rotate the Supabase secret automatically (needs Management API access), or just generate a new value, show it once, and you paste it into project secrets yourself?
