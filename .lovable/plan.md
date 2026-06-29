# Inbox Page v2 — Developer Tools, Error Alerts & Smart Reply Editor

Purely additive on top of the existing Inbox Manager. No existing endpoints/logic change.

## 1. Data layer (additive)

New tables:

- `webhook_logs` — every webhook hit
  - `id, endpoint, method, status` (`success` | `failed`), `status_code, response_ms, payload jsonb, response jsonb, error text, created_at`
- `pipeline_events` — per-message pipeline tracer
  - `id, message_id (FK inbox_messages), prospect_id, step` (`webhook_received` | `stored` | `classified` | `demo` | `reply_generated` | `sent`), `status` (`ok` | `skipped` | `failed`), `details jsonb` (raw AI output, rule fired, model, confidence, reasoning), `error text, created_at`
- `error_events` — failures-only feed (denormalized for fast UI)
  - `id, source` (webhook/classify/demo/send), `message_id, prospect_id, message text, stack text, acknowledged bool, created_at`
- `reply_templates` — editable templates with locked variables
  - `id, classification` (Positive/Negative/Objection), `body text` (uses `{{demo_url}}`, `{{firstname}}`, `{{company}}`, `{{sender_name}}`, `{{sender_email}}`), `locked_vars text[]`, `updated_at`

All four tables: RLS enabled, GRANT to `authenticated` + `service_role`, added to `supabase_realtime` publication. Seed `reply_templates` with the current 3 default bodies.

## 2. Edge function instrumentation (additive wrappers)

Add a shared helper `_shared/observability.ts` with:

- `logWebhook({endpoint, status, status_code, response_ms, payload, response, error})`
- `traceStep(message_id, prospect_id, step, status, details?, error?)`
- `logError(source, message_id, prospect_id, message, stack)` → also inserts into `error_events`

Wire it into existing functions WITHOUT changing their behavior:

- `webhook-manyreach-reply` — logs every hit + `webhook_received` step
- `inbox-process-incoming` — `stored`, `classified` (with raw AI JSON + rule fired e.g. `"demo_sent=true → forced Objection"`), `demo`, `reply_generated`, `sent`
- `inbox-classify` — returns raw model output + reasoning/confidence (already extracted, just persisted into `pipeline_events.details`)
- `inbox-send-reply`, `inbox-manual-reply` — `sent` step + error capture
- `inbox-actions` (regenerate/generate_demo) — traces

New function `inbox-dev-test-webhook` — POSTs a sample ManyReach payload to `webhook-manyreach-reply?key=<INBOX_WEBHOOK_SECRET>` from server-side, returns `{ status, ms, body }` to the UI.

## 3. UI — `InboxManagerPanel.tsx`

Top of panel: segmented control **User View | Developer View** (persisted in `localStorage`).

### Shared header

- Bell icon with unread error count (live, from `error_events` realtime). Dropdown lists recent errors; clicking jumps to that message and opens the Pipeline Tracer drawer.
- Red toast (sonner) auto-fires on new `error_events` rows.

### User View

Existing UI unchanged. Classification shown as the friendly badge only (🟢/🔴/🟡).

### Developer View

Adds, inside the existing thread pane, a collapsible **Pipeline Tracer** strip for the selected conversation:

```
Webhook ✅ 12:04:01 → Stored ✅ → Classified ✅ Positive (0.92) → Demo ✅ → Reply ✅ → Sent ✅
```

Each node expands to show raw JSON (collapsible viewer).

Adds new tabs alongside Inbox/Reply Prompts:

- **Webhook Logs** — table (timestamp, endpoint, status, ms, payload preview), row click → raw JSON viewer. "Send Test Webhook" button calls `inbox-dev-test-webhook` and renders status + body inline.
- **Error Log** — failures feed with stack excerpt + "Jump to message" link + acknowledge button.
- **Reply Templates** — new tab to edit the 3 templates (separate from the existing classification system-prompt editor).

Incoming messages in Developer View also show, under the badge: raw AI output, rule fired, confidence.

### Smart Reply Editor (replaces the plain `<Textarea>` composer)

New component `SmartReplyEditor.tsx` built on `contentEditable` (no new dependency):

- Renders `{{var}}` tokens as locked pill chips (non-editable, deletable as a unit) using `contenteditable="false"` spans
- Plain text around them is freely editable
- "Insert variable" dropdown: `{{firstname}}`, `{{company}}`, `{{sender_name}}`, `{{sender_email}}`, `{{demo_url}}`
- "Load template" dropdown loads the current classification's `reply_templates.body` with chips already locked
- On Send/Regenerate, serializes back to a string with `{{var}}` markers; existing `inbox-manual-reply` / send pipeline performs variable substitution server-side (extend the existing substitution map; add `{{sender_name}}` derived from `sender_email` local-part if not provided)

### Animations / polish

- `animate-fade-in` on tracer nodes, `animate-scale-in` on bell badge, subtle pulse on failed nodes
- Skeletons for logs, smooth tab transitions, status dots use the same semantic color tokens already in the panel
- Mobile: tracer collapses to a vertical timeline

## 4. Files

New:

- `supabase/functions/_shared/observability.ts`
- `supabase/functions/inbox-dev-test-webhook/index.ts`
- `src/components/admin/inbox/DevToolsView.tsx`
- `src/components/admin/inbox/PipelineTracer.tsx`
- `src/components/admin/inbox/WebhookLogsTab.tsx`
- `src/components/admin/inbox/ErrorLogTab.tsx`
- `src/components/admin/inbox/ReplyTemplatesTab.tsx`
- `src/components/admin/inbox/SmartReplyEditor.tsx`
- `src/components/admin/inbox/ErrorBell.tsx`
- DB migration for the 4 new tables, RLS, GRANTs, realtime publication, seed templates

Modified (additive only):

- `src/components/admin/InboxManagerPanel.tsx` — view toggle, bell, dev tabs, swap composer to `SmartReplyEditor`
- `webhook-manyreach-reply`, `inbox-process-incoming`, `inbox-classify`, `inbox-send-reply`, `inbox-manual-reply`, `inbox-actions` — add tracing/error-log calls (no logic changes)
- `supabase/config.toml` — register `inbox-dev-test-webhook` with `verify_jwt = false` (internal callable via supabase.functions.invoke from authed admin only; checks admin in code)

## 5. Optional (off by default)

Slack/email alert hook in `logError`: if `SLACK_WEBHOOK_URL` secret exists, post a one-line alert. Will prompt for the secret only if you confirm you want it.

## Smart Reply Logic v2 — Template-First with AI Fallback + "Demo Sent Once" Rule

This fixes the core logic gap: right now your system could risk re-sending the demo link or re-generating it every time. Here's the proper rule set + the smart fallback chain (Template → AI → never break).

---

### 1. The Core Rule: Demo Link Sent ONCE, Ever

Per prospect, across their entire history:

- **First positive/negative reply** → generate demo (if not exists) → send reply WITH `{{demo_url}}` → mark `demos.sent_to_prospect = true` (or just check `demos` table exists for that prospect — same thing)
- **Every reply after that** → demo already exists, link already sent → **never regenerate, never resend the link again** unless the prospect explicitly asks for it again (e.g. "can you resend the link")
- After the link is sent once, ALL future replies fall into one of these three buckets, full stop:


| Their reply                                                  | Meaning                              | Reply category       | Demo link?                                         |
| ------------------------------------------------------------ | ------------------------------------ | -------------------- | -------------------------------------------------- |
| "yes this looks great" / "I like it" / "let's talk"          | They liked the demo → still Positive | Positive (post-demo) | No — don't resend                                  |
| "not for us" / "no thanks"                                   | They didn't like it → Negative       | Negative (post-demo) | No                                                 |
| "how does the voice agent work?" / "price?" / "can it do X?" | Unsure / question                    | Objection            | No (unless they explicitly ask for the link again) |


So really there are **two phases** in the conversation:

- **Phase 1 (pre-demo):** Positive or Negative only → triggers demo creation + first link send
- **Phase 2 (post-demo):** Positive, Negative, or Objection → never triggers demo creation again, just a contextual reply

This is the part your classifier already half-does (the `demo_sent` check) — we're just making sure the *reply generation* and *demo creation* steps respect it the same way, every time, with no exceptions.

---

### 2. Template-First, AI-Fallback Logic (the "if/else" that can't collapse)

For every reply being generated, the system checks in this order:

```
1. Determine classification (Positive / Negative / Objection) 
   AND phase (pre-demo / post-demo) — using full history, always.

2. Look up: is there a template marked as_default=true for this 
   exact (classification + phase) combination?

   IF YES → use that template:
      - Fill in {{firstname}}, {{company}}, {{sender_name}}
      - Fill in {{demo_url}} ONLY if phase = pre-demo (first send)
      - If phase = post-demo, strip/skip the {{demo_url}} chip 
        entirely from the template (even if the template has it — 
        post-demo templates should just not include it in the 
        first place, but this is a safety check)
      - Send this. AI is NOT called. Done.

   IF NO template exists for this combination →
      - Fall back to AI generation:
        - Call ai-generate-reply with full conversation history, 
          classification, phase, and demo_url (if pre-demo)
        - AI writes the reply
        - Same rule applies: AI is instructed never to include a 
          demo link if phase = post-demo
      - Send this.

3. Either path MUST produce a reply. If template lookup fails AND 
   AI call fails (e.g. API error) → do NOT send nothing. Fall back 
   to a hardcoded safe generic reply ("Thanks for your message — 
   I'll get back to you shortly") and flag this conversation in the 
   Developer error log as "fallback used" so you know to check it.
```

This guarantees: **template if available → AI if not → safe generic message if both fail.** Nothing ever silently breaks or sends nothing.

---

### 3. Full History Check, Every Time

No classification or reply decision should ever look at just the latest message. Every single time:

- Pull the entire message thread for that prospect
- Check: does any `demos` row exist for this prospect? → determines phase (pre/post-demo)
- Check: what was the last classification on record? (useful for context, e.g. "this person already said Negative once before, now they're asking a question")
- Pass this full context into both the classifier AND the reply generator/template filler — so even template-filled replies aren't generic, they're aware of where in the journey this person is.

---

### 4. Updated Database Pieces

Add to `prospects` (or compute live from `demos` table — your choice, but explicit is safer):

```
demo_sent_at (timestamp, nullable)   -- null = pre-demo phase, 
                                          set = post-demo phase
```

Add to `templates`:

```
phase (text: 'pre_demo' | 'post_demo')   -- combined with category 
                                             (Positive/Negative/Objection) 
                                             this gives 6 possible 
                                             template slots total
```

So your template matrix becomes:


| &nbsp;    | Pre-demo                                                      | Post-demo                                      |
| --------- | ------------------------------------------------------------- | ---------------------------------------------- |
| Positive  | ✅ includes demo_url                                           | ✅ no demo_url                                  |
| Negative  | ✅ includes demo_url                                           | ✅ no demo_url                                  |
| Objection | N/A (objection only exists post-demo per your original rules) | ✅ no demo_url (unless explicit resend request) |


---

Confirm and I'll build it. Want the optional Slack/email alert wired in now, or skip for v2?