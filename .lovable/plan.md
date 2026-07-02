# Inbox Manager v5 — Cron, Behavior Mirroring, Health & Intelligence

Massive scope. Building in **5 phases** so each ships usable value without breaking existing systems.

## Phase 1 — Cron + Behavior Mirroring (foundation)

Wire the follow-up engine to actually run on a schedule and see prospect behavior.

- Enable `pg_cron` + `pg_net` extensions.
- Create 3 cron jobs (every 15 min) via `supabase--insert` (not migration — contains project URL + anon key):
  - `followup-evaluator` — scans prospects for trigger conditions
  - `followup-dispatcher` — sends pending rule-based events
  - `process-follow-up-enrollments` — advances multi-step sequences
- Mirror `demo_leads` behavior onto `prospects` so evaluator sees it:
  - New edge fn `sync-demo-behavior` (called from `track-event` / `track-visitor`) that copies `page_opened_at`, `link_clicked_at`, `voice_tried_at`, `chatbot_tried_at`, `last_activity_at` onto matching `prospects` row (join by email or demo_id).
  - Trigger on `demo_leads` UPDATE as backup mirror.

## Phase 2 — Pipeline & Follow-up Health Checks

- Extend `HealthCheckTab` with new "Follow-up Pipeline" section:
  - Cron job status (last run, next run, success rate) — read from `cron.job_run_details`
  - Evaluator: prospects considered / events created (last 24h)
  - Dispatcher: events sent / failed (last 24h)
  - Sequence engine: enrollments processed / failed
  - End-to-end trace button: "Simulate follow-up" creates a test prospect flagged `is_test_data=true`, walks it through evaluator → dispatcher → send (dry-run to a test endpoint), then deletes.
- Test data isolation: add `is_test_data` filter to all inbox queries so test rows never appear in real inbox.

## Phase 3 — Hot Lead Detection + Smart Send Time

Database:
- `prospect_activity_times` (prospect_id, day_of_week, hour_of_day, event_type)
- `demo_open_log` (prospect_id, demo_id, opened_at)
- `notifications` (type, prospect_id, message, read)
- `variable_fallbacks` (variable_key unique, fallback_value, description) — seeded
- Add to `prospects`: `is_hot_lead`, `hot_lead_detected_at`, `hot_lead_open_count`
- Add to `follow_up_enrollments`: `assigned_variant`, `replied_at`, `reply_classification`, `best_send_hour`, `best_send_day`
- Add to `follow_up_sequences_templates.ab_test_enabled`, `follow_up_steps.variant`

Edge functions:
- `get-best-send-time` — top day/hour from activity table
- `resume-hot-lead-sequence` — un-pause enrollments
- `mark-notification-read`

Backend wiring:
- Extend `track-event` / `track-visitor` to insert into `prospect_activity_times` + `demo_open_log`, then run 24h open-count check → set `is_hot_lead`, pause enrollments, insert notification.
- Extend `webhook-manyreach-reply` to log reply hour + set `enrollment.replied_at` + `reply_classification`.
- Extend `process-follow-up-enrollments` to call `get-best-send-time` and shift `next_step_at` to next optimal window (cap +48h), store used hour/day; substitute variables via `variable_fallbacks`.

UI:
- Inbox list: pin hot leads to top (48h), 🔥 badge, amber tint, engagement dots.
- Thread view: hot lead banner (Resume / Mark Contacted / dismiss), best-send-time metadata row below journey strip.
- Header: bell icon with realtime subscription to `notifications`.

## Phase 4 — Sequence Editor Intelligence

Purely in `FollowUpsPage.tsx` sequence editor (no backend):
- Live char count · sentence estimate · read time under each body + subject.
- 6 step health checks (debounced 800ms) as inline warnings.
- Cross-step checks + global "Health: Good / N warnings" pill at top.
- Email Preview modal (600px) with prev/next step navigation, sample data substitution using `variable_fallbacks`.
- Copy Step (📋 → JSON to clipboard) + Import from clipboard button.
- Import from sent message: search modal over `inbox_messages` (outgoing) → pastes body into current step.
- Variable toolbar tooltips show name + description + fallback.

**Remove deprecated templates**: delete "Pre-Demo" and "Post-Demo" template UI/tables (`follow_up_templates`) since AI agent handles those now — keep only the sequence builder + AI reply flow.

## Phase 5 — Sequence Analytics + A/B + Export

- Edge fn `get-sequence-analytics` — returns funnel, quality counts, heatmap grid, A/B split, smart-timing stats for a `sequence_template_id`.
- Edge fn `export-sequence-csv` — CSV attachment.
- New "View Analytics →" button on each sequence template card → full right-panel view replacing editor.
- 6 stat cards, step funnel bars (clickable → prospect list slide-in), reply quality bar, 7×24 heatmap (single-color opacity), Best Step card with Copy Message, A/B compare view + winner banner + Set as Default.
- Settings page: Variables editor table (edit fallback_value inline).

## Technical Details

**Cron SQL pattern** (via supabase--insert):
```sql
select cron.schedule('followup-evaluator', '*/15 * * * *', $$
  select net.http_post(
    url:='https://<project>.supabase.co/functions/v1/followup-evaluator',
    headers:='{"Content-Type":"application/json","apikey":"<anon>"}'::jsonb,
    body:='{}'::jsonb
  );
$$);
```

**Behavior mirror** — call `sync-demo-behavior(demo_id)` inside existing tracking endpoints; keeps `prospects` columns fresh so `followup-evaluator` can trigger on real behavior.

**Hot lead pause status** — new value `paused_hot_lead` in `follow_up_enrollments.status` (distinct from `cancelled`).

**Smart timing** — `process-follow-up-enrollments` shifts computed `next_step_at` forward to next `best_day` @ `best_hour`, but never more than +48h beyond the raw delay.

**Test data hiding** — inbox queries add `.eq('is_test_data', false)` filter; pipeline simulator sets flag on synthetic prospect.

## Scope Note

This is roughly **~25 files** (5 migrations, ~8 edge functions, ~10 UI components). I'll build phase-by-phase and check in after each so you can validate before moving on. Approve to start with **Phase 1 (cron + behavior mirroring)**.
