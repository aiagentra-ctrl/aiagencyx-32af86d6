## Plan: Smart Lead Intelligence + ManyReach Follow-Up (Additive Only)

All work is **additive**. No existing endpoint, field, response shape, or behavior changes. New fields are optional. New tables/columns are nullable.

---

### 1. Database (additive migration)

**New table: `demo_leads`** — stores the pre-creation follow-up payload, linked to a demo.

Columns:
- `id`, `created_at`, `updated_at`
- `demo_page_id` (uuid, nullable, references `demo_pages.id`)
- `slug` (text, indexed) — the bridge between creation & visit
- `first_name`, `company`, `campaign_name`, `industry`
- `campaign_id`, `lead_source`, `sender_email`, `message_thread_id`
- `cc_emails` (jsonb), `bcc_emails` (jsonb)
- `is_complete` (bool) — true only if all required follow-up fields present
- `status` (text) — `pending` | `visited_no_demo` | `visited_demo_tried` | `followed_up` | `blocked_country` | `incomplete`
- `lead_score` (int, default 0)
- `score_tier` (text) — `high` | `medium` | `low`
- `country_code`, `visitor_session_id`
- `demo_tried` (bool, default false)
- `demo_type_tried` (text) — `voice` | `chatbot` | null
- `last_visit_at`, `follow_up_sent_at`, `follow_up_message_id`
- `engagement` (jsonb) — accumulated metrics (time, scroll, clicks, return visits)

**New table: `manyreach_logs`** — every send attempt:
- `lead_id`, `slug`, `campaign_id`, `thread_id`, `status` (sent/failed), `request_payload`, `response_payload`, `lead_score`, `created_at`

**New table: `country_rules`** (or single `site_settings` row `country_allowlist` / `country_blocklist`) — keep it as two `site_settings` keys to stay light:
- `country_allowlist` = `US,CA,GB,AU,AE,DE,FR,...`
- `country_blocklist` = `NP,IN,BD,PK,...`

RLS: `service_role` full; anon read on `demo_leads` disabled (sensitive). Anon insert allowed only via edge functions (service role).

---

### 2. `create-demo` — extend without changing existing behavior

Accept new **optional** body fields (all unrelated to existing flow):
```
firstName, company, campaignName, industry,
campaignId, leadSource, senderEmail, messageThreadId,
ccEmails[], bccEmails[]
```

After the existing demo creation succeeds:
- Insert one row into `demo_leads` with `slug` + `demo_page_id`.
- Compute `is_complete`: requires `firstName`, `senderEmail`, `campaignId`, `messageThreadId`, `leadSource`. Missing → `status=incomplete`, no automation later.
- Existing response payload **unchanged** — optionally add `lead_id` only if follow-up fields were sent (purely additive key).

No edits to existing prompt, scraping, VAPI, or page-creation logic.

---

### 3. New edge function: `track-visitor` (smart visitor tracking)

Separate from existing `track-event` (which stays untouched). Frontend keeps calling `track-event` exactly as today; `track-visitor` is called additionally from `DemoPage` for lead-intelligence aggregation.

Captures per session:
- country, device, browser, OS (reuse parser from `track-event`)
- time on page, scroll depth, return visit count
- demo interactions (`voice_call_started`, `chatbot_message_sent`)
- CTA clicks, form submissions
- UTM params + `lead_source`
- session id

**Country gate (runs first):**
- Resolve country from IP.
- If in blocklist → return `{ ok:true, filtered:"country" }`. Do NOT write to `demo_leads`, do NOT write to `link_events`. Silent exit.
- If not in allowlist (and allowlist is set) → same silent exit.
- Else proceed.

Updates `demo_leads` row matched by `slug`:
- merge engagement jsonb
- set `country_code`, `visitor_session_id`, `last_visit_at`
- set `demo_tried=true` + `demo_type_tried` when interaction event arrives
- recompute `lead_score` + `score_tier`

If no `demo_leads` row exists for the slug (demo created without follow-up data) → just log to `activity_logs`, no follow-up will ever fire.

---

### 4. Engagement scoring engine (inside `track-visitor`)

Pure function `computeScore(engagement)`:
- time on page: up to 20
- scroll depth: up to 15
- click count: up to 15
- demo interaction: +30 (voice or chatbot)
- return visits: up to 10
- CTA click: +10

Tiers: `high` 70–100, `medium` 40–69, `low` 0–39.

Stored on `demo_leads` and forwarded to follow-up trigger.

---

### 5. New edge function: `trigger-follow-up`

Called by `track-visitor` when:
1. `demo_leads.is_complete = true`
2. `country_code` in allowlist
3. session activity recorded
4. `follow_up_sent_at` is null
5. Debounce: at least N seconds of inactivity (e.g. 60s) — invoked via deferred check or on `session_end` event

Decision:
- `demo_tried=true` → "feedback" template
- `demo_tried=false` → "re-engagement" template

Builds ManyReach payload and POSTs to `https://api.manyreach.com/api/v2/messages/reply`:
```
threadId, sendAsReply:true, from, cc, bcc, body(HTML),
variables:{FirstName,Company,CampaignName,Industry},
campaignId, attachments?
```

Auth via new secret `MANYREACH_API_KEY` (request via add_secret).

Logs request + response to `manyreach_logs` with `slug`, `campaign_id`, `thread_id`, `lead_score`. On success set `follow_up_sent_at`, `follow_up_message_id`, `status=followed_up`.

Errors are caught, logged, never thrown to the visitor path.

---

### 6. Frontend (`DemoPage.tsx` + `tracking.ts`)

Additive only:
- After existing `track-event` calls, also fire `track-visitor` with the same session id and metadata.
- Send `voice_call_started` / `chatbot_message_sent` events when those interactions occur (already present — just mirror to `track-visitor`).
- On `beforeunload` fire a final `track-visitor` event of type `session_end` so `trigger-follow-up` can decide.

No UI changes. No removal of existing tracking.

---

### 7. Admin (optional, low-risk add)

Add a small "Leads (ManyReach)" tab in `AdminDashboard` that reads `demo_leads` + `manyreach_logs` (read-only). Skippable if user wants minimal scope.

---

### 8. Secrets

New required secret:
- `MANYREACH_API_KEY` (will request via `add_secret` after plan approval)

Existing secrets untouched.

---

### 9. `supabase/config.toml`

Add `verify_jwt = false` blocks for the two new functions only:
```
[functions.track-visitor]
verify_jwt = false
[functions.trigger-follow-up]
verify_jwt = false
```

---

### 10. Files

| File | Change |
|------|--------|
| `supabase/migrations/<new>.sql` | new tables, indexes, RLS, country settings rows |
| `supabase/functions/create-demo/index.ts` | accept new optional fields, insert `demo_leads` row after success |
| `supabase/functions/track-visitor/index.ts` | NEW — gating, aggregation, scoring, trigger dispatch |
| `supabase/functions/trigger-follow-up/index.ts` | NEW — ManyReach sender + logging |
| `supabase/config.toml` | register the two new functions |
| `src/lib/tracking.ts` | mirror events to `track-visitor` (additive) |
| `src/pages/DemoPage.tsx` | wire interaction + session_end signals to `track-visitor` |
| `src/components/admin/LeadsPanel.tsx` *(optional)* | new ManyReach leads view |

---

### Guarantees
- Existing `create-demo` response shape preserved; new keys only when relevant.
- `track-event` and `link_events` untouched.
- Blocked-country visitors leave zero footprint.
- Incomplete leads never trigger ManyReach.
- Every send is logged with full payload and score.

Confirm and I'll implement, then request the `MANYREACH_API_KEY` secret.
