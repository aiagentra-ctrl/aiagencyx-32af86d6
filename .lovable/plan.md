# Behavioral Follow-up Engine + Webhook Secrets Display

Add a behavior-driven follow-up system on top of the existing Inbox Manager, plus show configured webhook secrets in the dashboard. All existing flows (webhook → classify → demo → AI reply → send) stay intact.

## 1. Database changes (migration)

`**prospects` — new columns for threading + follow-up state**

- `original_message_id` (text) — first inbound ManyReach messageId, used to thread every future follow-up
- `demo_link_clicked_at`, `demo_page_opened_at`, `voice_tried_at`, `chatbot_tried_at` (timestamptz)
- `last_activity_at` (timestamptz)
- `followup_attempts` (int default 0), `max_followup_attempts` (int default 2)
- `followup_status` (text: `none | scheduled | pending | sent | responded | paused`)
- `next_followup_at` (timestamptz), `next_followup_trigger` (text)

`**followup_rules**` (settings, one row per trigger type)

- `trigger_key` (text unique): `no_click_48h`, `clicked_no_open`, `opened_no_try`, `tried_voice_only`, `tried_chat_only`, `tried_both_no_reply`
- `delay_hours` (int), `enabled` (bool), `auto_send` (bool default false), `prompt_override` (text nullable)
- Seed with the 6 defaults from the spec.

`**followup_events**` (queue + audit log)

- `prospect_id`, `trigger_key`, `status` (`pending|sent|skipped|failed|responded`)
- `scheduled_at`, `sent_at`, `message_body`, `manyreach_message_id`, `error`

`**followup_settings**` (global toggles) — reuse existing `followup_settings` key/value table; add keys `auto_send`, `max_attempts`, per-trigger delay hours.

Standard grants + RLS (admin-only via existing pattern).

## 2. Wire threading into existing flow (no behavior change)

- `webhook-manyreach-reply`: when creating/updating a prospect, capture ManyReach `messageId` into `prospects.original_message_id` **only if null** (first inbound reply becomes the thread anchor).
- `track-visitor`: when it flips `tried_voice` / `tried_chat` / demo click / page open on `demo_leads`, also mirror the timestamps onto the matching `prospects` row (join on email or existing `demo_leads.prospect_id` if present; add link column if missing) and update `last_activity_at`.
- Prospect responding (new inbound after a follow-up sent) → mark `followup_status = 'responded'`, cancel any pending `followup_events`.

## 3. Edge functions (new)

- `**followup-evaluator**` (cron, every 30 min via `pg_cron` + `pg_net`): scans prospects, applies rule matrix, inserts `followup_events` rows with `scheduled_at`, updates `next_followup_at`/`trigger`. Respects `paused`, `max_attempts`, `enabled`, cooling-off since last send.
- `**followup-generate**`: given `prospect_id` + `trigger_key`, calls Lovable AI with a per-trigger system prompt (stored in `inbox_prompts` under keys like `followup_no_click_48h`) plus prospect + demo context. Returns message body.
- `**followup-send**`: takes a `followup_events` row (or `event_id`), calls ManyReach `POST /api/v2/messages/reply` with:
  ```
  { messageId: prospects.original_message_id,
    subject: "Re: {firstname} overview",
    body, sendAsReply: "true",
    fromEmail: prospects.sender_email,
    replyToEmail: prospects.email }
  ```
  Logs to `webhook_logs` / `pipeline_events`, appends to `inbox_messages` as outgoing, increments `followup_attempts`, sets `followup_status = 'sent'`.
- `**followup-run-now**`: admin-triggered wrapper to generate + send (or just generate for manual review) for one prospect.

Rule matrix (`followup-evaluator`):

```text
no reply activity & !demo_link_clicked_at   & age >= no_click_delay        → no_click_48h
clicked & !demo_page_opened_at              & age(click) >= clicked_delay  → clicked_no_open
opened  & !voice_tried & !chatbot_tried     & age(open)  >= opened_delay   → opened_no_try
voice_tried & !chatbot_tried                & age(voice) >= tried_delay    → tried_voice_only
chatbot_tried & !voice_tried                & age(chat)  >= tried_delay    → tried_chat_only
voice_tried & chatbot_tried & !responded    & age(last)  >= tried_delay    → tried_both_no_reply
```

## 4. UI additions (all inside existing Admin → Inbox Manager, matching current styling)

**a. Webhook secrets card** (Developer View → Webhook Logs tab, next to `WebhookUrlCard`):

- Lists configured secrets by name only (from a new tiny `get-secret-status` function or reuse existing pattern): `MANYREACH_API_KEY`, `INBOX_WEBHOOK_SECRET`, `NETLIFY_API_TOKEN`, `NETLIFY_SITE_ID`, `SITE_URL`, `SITE_DOMAIN`, `VAPI_API_KEY`, `LOVABLE_API_KEY`.
- Each row: name, ✅ Configured / ⚠ Missing badge, "Update" button that opens Lovable secret update flow. Never renders secret values.

**b. Leads / prospect list — behavioral columns**

- Extend the existing inbox list (or Leads panel) with the columns from the spec: Demo Sent, Clicked, Pg Open, Voice, Chatbot, Follow-up Status (pill).
- Filter pills row: `All | No Interaction | Clicked Only | Opened, No Try | Partial | Full | Responded`.

**c. Thread view — Behavioral Status Bar** (above chat thread in `InboxManagerPanel`)

- Journey stepper: Demo Sent → Link Clicked → Page Opened → Voice Tried → Chatbot Tried with timestamps and grey/green states.
- Demo URL with Copy button.
- "Follow-up #N scheduled in Xh · [Send now] [Edit] [Pause automation]".

**d. New Follow-ups page** (`/admin` new tab "Follow-ups")

- Settings strip: delay inputs per trigger, Auto-send toggle, Max attempts, Save.
- Stats: Pending / Sent Today / Recovery Rate (responded within N days of a follow-up send).
- Kanban 3 columns: Pending · Sent · Responded. Cards show prospect, trigger, attempt #, actions (Edit, Send, Skip, View thread).
- "+ Create Follow-up" opens dialog to manually schedule a trigger for a prospect.

## 5. Cron

Register `pg_cron` job every 30 min hitting `followup-evaluator` (using the project's anon key pattern per `schedule-jobs` guidance). Second job every 5 min hitting a `followup-dispatcher` that picks up `pending` events whose `scheduled_at <= now()` and, if `auto_send=true`, calls `followup-send`; otherwise leaves them pending for manual approval.

## 6. Non-goals / safety

- No changes to the existing v4 pipeline logic, prompts, or ManyReach inbound handler behavior beyond capturing `original_message_id`.
- Follow-ups never fire while `prospects.automation_paused = true` or if a newer inbound message exists after the last send.
- All new tables admin-only via existing role check; edge functions use service role.

## Files touched (technical)

- Migration: new columns + `followup_rules`, `followup_events`, seeds, grants, RLS.
- New edge functions: `followup-evaluator`, `followup-generate`, `followup-send`, `followup-dispatcher`, `followup-run-now`, `get-secret-status`.
- Updated: `webhook-manyreach-reply` (capture `original_message_id`), `track-visitor` (mirror behavioral timestamps to `prospects`), `inbox-process-incoming` (mark `responded` + cancel pending events on new inbound).
- Frontend: extend `InboxManagerPanel` (status bar, columns, filters), add `WebhookSecretsCard.tsx`, add `FollowUpsPage.tsx` + Kanban components; new tab entry in `AdminDashboard`.
- Seed new `inbox_prompts` rows for 6 follow-up trigger prompts.

Approve to start with the migration + threading capture, then edge functions, then UI.

Build a self-serve Follow-up Sequence Builder inside my existing 

Follow-ups page. This lets me create and manage my own follow-up 

sequences from scratch — choosing how many steps, the exact delay 

between each, and writing the message myself (with all available 

variables insertable). No fixed/hardcoded sequences — everything 

is configurable by me. Backend: Supabase (Postgres + Edge Functions).

## DATABASE TABLES

follow_up_sequences_templates (the reusable sequence blueprints 

I build myself in the UI):

- id (uuid PK)

- name (text — e.g. "No Click 4-Step", "Post-Demo Nudge")

- trigger_type (text: 'no_click'|'clicked_no_open'|

  'opened_no_interaction'|'tried_voice_only'|'tried_chat_only'|

  'full_engage_no_reply'|'custom')

- is_active (bool, default true)

- created_at (timestamp)

follow_up_steps (each individual step inside a sequence template):

- id (uuid PK)

- sequence_template_id (uuid FK → follow_up_sequences_templates)

- step_number (int — 1, 2, 3, 4...)

- delay_value (int — the number part, e.g. 2)

- delay_unit (text: 'hours'|'days'|'weeks')

- message_subject (text — email subject line)

- message_body (text — the message with {{variables}} inside)

- include_demo_link (bool — whether to include {{demo_url}} 

  in this specific step or not)

- created_at (timestamp)

follow_up_enrollments (tracks which prospects are currently 

going through which sequence, and where they are in it):

- id (uuid PK)

- prospect_id (uuid FK → prospects)

- sequence_template_id (uuid FK)

- current_step (int, default 1)

- status (text: 'active'|'completed'|'cancelled'|'responded')

- started_at (timestamp)

- next_step_at (timestamp — when the next step should fire)

- completed_at (timestamp, nullable)

## PAGE LAYOUT: FOLLOW-UP SEQUENCE BUILDER

Add a new sub-section to the existing Follow-ups page (or a 

separate tab "Sequences"). Two-panel layout:

- Left panel (35%): list of all my saved sequence templates

- Right panel (65%): sequence editor (opens when I click a 

  template or click "New Sequence")

### LEFT PANEL — SEQUENCE LIST

Header: "My Sequences" + [+ New Sequence] button

Each row shows:

- Sequence name

- Trigger type tag (colored pill)

- Number of steps badge (e.g. "4 steps")

- Active/inactive toggle

- Edit / Duplicate / Delete icons

Empty state: "No sequences yet — click + New Sequence to build 

your first one."

### RIGHT PANEL — SEQUENCE EDITOR

When creating or editing a sequence, show:

TOP SECTION:

- Sequence name input (text field, e.g. "No Click 4-Step")

- Trigger type dropdown:

  "No Link Click" | "Clicked, No Page Open" | 

  "Opened, No Interaction" | "Tried Voice Only" | 

  "Tried Chat Only" | "Full Engagement, No Reply" | "Custom"

- [Save Sequence] button (top right, primary)

STEPS SECTION (the core of the builder):

Each step is a card. Show them stacked vertically in order.

Each step card contains:

1. Step header: "Step [N]" label + [Delete this step] icon 

   (X) top right. Cannot delete Step 1.

2. Delay row (shown above step 1 as "Send immediately after 

   trigger", shown above steps 2+ as "Wait before this step"):

   - For Step 1: label "Send [delay_value] [delay_unit] after 

     trigger fires" with inline number input + unit dropdown 

     (hours/days/weeks)

   - For Steps 2+: label "Then wait [delay_value] [delay_unit]" 

     with same inputs

   Example rendered: "Then wait [2] [days ▼]"

3. Subject line input: text field labeled "Email Subject" 

   (pre-filled with "Re: {{firstname}} overview" as default, 

   fully editable)

4. Message body editor: a textarea with a variable toolbar 

   ABOVE it showing all available variables as clickable 

   chips/buttons. Clicking a variable chip inserts it at the 

   current cursor position in the textarea.

AVAILABLE VARIABLES TOOLBAR (show these as clickable pill 

buttons above the message textarea, organized in a horizontal 

row that wraps if needed):

   {{firstname}} — prospect's first name

   {{lastname}} — prospect's last name  

   {{company}} — company name

   {{website}} — their website URL

   {{demo_url}} — the personalized demo link

   {{sender_name}} — your name (sender)

   {{sender_email}} — your email address

   {{campaign_name}} — campaign this lead came from

   {{days_since_demo}} — how many days since demo was sent

   {{days_since_click}} — days since they clicked the link

   {{days_since_open}} — days since they opened the demo page

Each chip: small pill, click to insert, shows the variable name. 

On hover, show a small tooltip describing what that variable 

resolves to (e.g. "{{company}} → The prospect's company name").

5. Include demo link toggle: "Include {{demo_url}} in this 

   step: [ON/OFF]" — when OFF, strips {{demo_url}} from the 

   message even if it's in the body text (safety check). 

   Recommended ON for step 2+, optional for step 1.

6. Preview button per step: "Preview with sample data" — 

   renders the message body with placeholder sample values 

   substituted (John, Acme Inc, [https://aiagentfor.lovable.app/](https://aiagentfor.lovable.app/)

   acme-inc, etc.) in a read-only text box below the editor 

   so I can see exactly how it'll look before saving.

BOTTOM OF STEPS:

[+ Add Step] button — adds a new empty step card at the bottom 

with default delay of "2 days" and empty subject/body. No limit 

on number of steps (but show a soft warning at 6+ steps: "Most 

sequences perform best with 3-5 steps").

Step cards can be reordered via drag-and-drop (drag handle icon 

on the left side of each card). Step numbers auto-update when 

reordered.

### TIMELINE PREVIEW STRIP

Between the steps section and the [+ Add Step] button, show a 

compact horizontal timeline visualization of the whole sequence 

showing relative timing:

Day 0: Trigger fires

  → [2d] → Step 1: "Subject line preview..."

  → [3d] → Step 2: "Subject line preview..."

  → [5d] → Step 3: "Subject line preview..."

  → [7d] → Step 4: "Subject line preview..."

  Total duration: 17 days

This updates in real time as I edit delays. Makes it easy to 

see the full sequence rhythm at a glance without scrolling 

through all the cards.

## ENROLL PROSPECTS INTO A SEQUENCE

On the Follow-ups page (the existing kanban/queue view), add 

an [Enroll in Sequence] button on each prospect's card/row. 

Clicking it opens a small modal:

- Shows prospect name + company

- Dropdown: "Select sequence" (lists all active sequence 

  templates with their trigger types and step counts)

- "Start from step: [1]" (number input — lets me skip steps 

  if needed, e.g. if they already received step 1 manually)

- "Send first step: [Now] / [Schedule: datetime picker]"

- [Enroll] button

On enroll: creates a follow_up_enrollments row, calculates 

next_step_at based on Step 1's delay from now (or from 

scheduled time), sets status='active'.

Also add a bulk enroll option: in the Leads table, select 

multiple prospects via checkboxes → bulk action bar appears → 

"Enroll selected in sequence" → same modal as above but applies 

to all selected prospects.

## SEQUENCE EXECUTION (cron, every 15 min)

Edge Function: process-follow-up-enrollments

Scheduled via pg_cron every 15 minutes.

Finds all follow_up_enrollments where:

- status = 'active'

- next_step_at <= now()

- prospects.automation_paused = false

- No incoming message from prospect after enrollment 

  started_at (if they replied, cancel the sequence)

For each due enrollment:

1. Fetch the sequence step matching current_step number

2. Substitute all variables in message_body and subject:

   - {{firstname}}, {{company}}, etc. from prospects table

   - {{demo_url}}: fetch from demos table for this prospect, 

     wrap through track-link-click redirect URL

   - {{days_since_demo}}: calculate from demos.created_at

   - {{days_since_click}}: calculate from [demos.link](http://demos.link)_clicked_at 

     (or "—" if not clicked)

   - {{days_since_open}}: calculate from [demos.page](http://demos.page)_opened_at

3. If step.include_demo_link = false: remove any remaining 

   {{demo_url}} occurrences from the final message body

4. Send via ManyReach:

   POST [https://api.manyreach.com/api/v2/messages/reply](https://api.manyreach.com/api/v2/messages/reply)

   Headers: { X-API-Key: [MANYREACH_API_KEY from secrets],

              Content-Type: application/json }

   Body: {

     "messageId": "[prospects.original_message_id]",

     "subject": "[substituted message_subject]",

     "body": "[substituted message_body]",

     "sendAsReply": "true",

     "fromEmail": "[prospects.sender_email]",

     "replyToEmail": "[[prospects.email](http://prospects.email)]"

   }

5. On success:

   - Insert into messages table (direction='outgoing', 

     source='followup_sequence', body=final_body)

   - If current_step < total steps in this sequence:

     advance current_step by 1, calculate new next_step_at 

     (now() + next step's delay), update enrollment

   - If current_step = last step:

     set enrollment.status='completed', completed_at=now()

     set prospect.status='Cold' (sequence exhausted, no reply)

6. On failure:

   - Log to pipeline_events (status='failed')

   - Do NOT advance step — retry on next cron run (max 3 

     retries, then mark enrollment as 'failed' and alert)

7. If prospect replies at any point (detected via incoming 

   message in messages table after enrollment.started_at):

   - Set enrollment.status='responded', completed_at=now()

   - Cancel all pending steps (do not send remaining steps)

   - Update prospect.status accordingly

## STOPS/CANCELLATION RULES (critical)

A sequence enrollment is automatically cancelled when:

- Prospect sends ANY incoming message (they replied — stop 

  all follow-ups)

- Prospect's automation_paused is set to true

- The sequence template is deactivated (is_active=false)

- Enrollment is manually cancelled from the dashboard

## DASHBOARD: SEQUENCE PERFORMANCE STATS

At the top of the Sequences left panel, show aggregate stats:

- Total active enrollments

- Completed this week (reached last step without reply)

- Responded (cancelled due to reply — the good outcome)

- Response rate per sequence (responses/enrollments as %)

On each sequence template row in the left panel, show a 

mini stat: "[N] active · [X]% response rate"

## CURRENT ENROLLMENT STATUS IN INBOX

In the Inbox conversation list, add a small tag to each 

conversation row if that prospect has an active enrollment: 

"📧 Seq step 2/4" — so I can see at a glance which 

conversations have an active follow-up sequence running.

## BUILD ORDER

1. follow_up_sequences_templates + follow_up_steps tables

2. follow_up_enrollments table

3. Sequence Builder UI (left panel list + right panel editor 

   with variable toolbar, step cards, timeline preview)

4. process-follow-up-enrollments cron + variable substitution

5. Enroll modal (single + bulk enroll from Leads table)

6. Auto-cancel on incoming reply (add check to existing 

   webhook receiver)

7. Sequence stats on left panel

8. Inbox "Seq step X/Y" tag