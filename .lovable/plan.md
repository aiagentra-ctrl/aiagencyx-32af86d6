## Verified before planning

- `anthropic/claude-sonnet-5` **is** a live OpenRouter model slug (confirmed against the OpenRouter model list).
- 11 edge functions still call `https://ai.gateway.lovable.dev`: `inbox-generate-reply`, `inbox-classify`, `followup-generate`, `chatbot-conversation`, `create-demo`, `create-ai-system`, `generate-voice-prompt`, `scrape-and-analyze`, `search-knowledge-base`, `run-health-check`, `get-secret-status`.
- A shared OpenRouter client already exists (`supabase/functions/_shared/openrouter.ts`) with fallback + timeout — the migration reuses it rather than adding a new one.
- `follow_up_steps` has only `include_demo_link` (boolean) — there is no CTA-type concept today, which is why sequences drift into inconsistent click variations.
- `prospect_memory` already tracks `demo_link_sent`, `classification_history`, `conversation_stage`, but `inbox-generate-reply` only uses it for the demo-link lock, not for lead status / re-pitch prevention.

## Recommendation: REST, not MCP (asked for before building)

**Stay on the ManyReach REST API. Do not route follow-up sending through `mcp.manyreach.com`.**

Reasons:
1. MCP auth is OAuth 2.1 + PKCE, a *user-interactive* browser flow. Follow-ups fire from unattended cron/edge functions with no browser and no user present — we'd have to store and silently refresh OAuth tokens ourselves, which is strictly more fragile than one `X-API-Key` header.
2. MCP adds a JSON-RPC + streaming layer on top of the same underlying REST calls — extra latency and one more failure surface for zero new capability for sending.
3. Lovable MCP connectors extend the *building* agent, not the deployed app, so an MCP connector would not be callable from our edge functions anyway.

Where MCP *is* worth it: as an optional **read/explore** channel later (campaign/prospect/sender catalog browsing in the dashboard). Not in this build. Plan below fixes REST properly and adds a UI console so new ManyReach features can be tested/added without code changes each time.

## 1. OpenRouter everywhere

- Extend `_shared/openrouter.ts`: add `MODELS.agent = "anthropic/claude-sonnet-5"` and make it the default for all inbox/follow-up/system-prompt calls; keep `openai/gpt-4o-mini` as automatic fallback.
- Replace the raw `fetch("https://ai.gateway.lovable.dev/...")` block in all 11 functions with `chatCompletion(...)` / `chatCompletionStream(...)`. Remove every `LOVABLE_API_KEY` read.
- `node_prompts.model` values pointing at `google/gemini-*` get remapped to the OpenRouter slug at read time so stored prompts keep working.
- `get-secret-status` / `run-health-check` report OpenRouter key status instead of Lovable key status.

## 2. Reply formatting + validation

New shared module `supabase/functions/_shared/reply-format.ts`:

- `SENDER_NAME` default **Abhiraj Yadav** (overridable per prospect, falls back to the constant everywhere — replaces the current `sender_email.split("@")[0]` derivation in `_shared/followup.ts`).
- `normalizeReply(text)` — repairs the exact breakage seen (`[link][Regards,][Sender Name]`): unwraps sign-off text swallowed into markdown brackets, forces the URL onto its own line as a bare/clean link, and puts `Regards,` + name on separate lines below.
- `validateReply(text)` returns `{ ok, errors }` checking: (a) balanced `[]()` with no stray brackets and no nested link text, (b) exactly one sign-off block, correctly formatted, (c) sender name present, (d) no duplicate URLs.
- Wired into `inbox-generate-reply`, `followup-generate`, `inbox-send-reply`, `followup-send`, `process-follow-up-enrollments`. On failure: retry generation once, then mark the message `needs_review` and **do not send** — surfaced in the Inbox UI with the validation errors.

## 3. Reply length rules

Rewrite the `positive_reply` / `negative_reply` / `objection_reply` rows in `node_prompts` (migration) to hard-cap output:

- Positive → one line + clean deep link: `Here it is: https://…`
- Negative → `Got it 👍 — this was actually made specifically for you: <link>` then `Best,` / `Abhiraj Yadav`
- `max_tokens` dropped to ~120 and a post-generation length guard truncates anything over 2 sentences before the sign-off.

## 4. Memory continuity

- Add `lead_status` + `last_classification` + `pitch_count` to `prospect_memory` (migration).
- `inbox-generate-reply` injects a compact memory block into the system prompt: current lead status, whether they already declined, whether the demo link was sent, prior classifications.
- Hard rule when status is `declined`: no re-pitch, no new link, single short acknowledgement — enforced in prompt *and* in the validator.
- `webhook-manyreach-reply` / `inbox-classify` write `lead_status` on every classification so state survives between messages.

## 5. Follow-up: exactly 3 CTA options

Migration: add `cta_type` to `follow_up_steps` — enum `link_only | demo_only | both` — backfilled from `include_demo_link`; `include_demo_link` kept as a derived column for compatibility.

- Central `buildCta(step, vars)` in `_shared/followup.ts` renders exactly one CTA block per step:
  - `link_only` → plain link, no demo wording
  - `demo_only` → "try the AI agent" CTA opening the chatbot/voice demo
  - `both` → link + demo option
- The renderer strips any CTA the template author typed manually, so a step can never emit duplicate or zero CTAs.
- `process-follow-up-enrollments` and `followup-send` both call `buildCta` — single code path, no divergence.
- Admin **Follow-up Templates** panel: replace the `include_demo_link` checkbox with a 3-way CTA selector + live preview of the rendered block.
- Migration normalizes all existing steps in every sequence to one of the three types.

## 6. ManyReach REST hardening + dashboard console

- New `_shared/manyreach.ts`: single client with `X-API-Key`, 15s timeout, 3 retries with backoff on 429/5xx, full request/response logging to `webhook_logs`, and typed non-2xx errors. All 6 ManyReach call sites (`followup-send`, `inbox-send-reply`, `process-follow-up-enrollments`, `inbox-manual-reply`, `process-email-queue`, `trigger-follow-up`) switch to it — this removes the current silent `.catch(() => ({}))` swallowing.
- New edge function `manyreach-proxy`: admin-only generic passthrough (`method`, `path`, `body`) so new ManyReach endpoints can be tried without a deploy.
- New **ManyReach** tab in Settings: connectivity check (account/campaign fetch), recent call log with status codes and latency, and a request console backed by `manyreach-proxy`.
- API key is read from the existing `MANYREACH_API_KEY` secret — nothing pasted in chat.

## 7. Follow-up timing audit

- Add a `scheduling_debug` write on each enrollment advance (raw due time, smart-shifted time, whether the shift applied) so late/early sends are diagnosable.
- Fix the duplicate-send window: claim due enrollments with a status flip to `sending` before the ManyReach call so a slow run can't be picked up twice by the next cron tick.
- Skip-protection: if `next_step_at` is far in the past, send immediately and log the lag instead of silently rolling forward.
- Health page gets a "Follow-up timing" card: due-now count, overdue count, last dispatcher run, average lag.

## Technical notes

- Migrations: `follow_up_steps.cta_type`, `prospect_memory.lead_status/last_classification/pitch_count`, `node_prompts` prompt rewrites, backfill of existing steps.
- No changes to the demo-link 3-layer lock — it stays and is now also checked by the validator.
- All touched edge functions redeployed at the end.
