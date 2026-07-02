# Unified Dashboard Rebuild — Full Spec

Redesigns the entire admin experience into one coherent product. Preserves every backend feature already built (webhook pipeline, classify/reply agents, follow-up rules + sequence engine, hot-lead detection, smart send-time, analytics, variable fallbacks, health check) and adds the AI Memory layer + a new global shell, sidebar, notification center, and 8 pages.

Nothing existing gets deleted until its replacement is wired.

---

## Phase 1 — Database & Seed

New migration adds only what's missing (most tables already exist):

**New tables**
- `prospect_memory` — one row per prospect, JSONB brain (demo_link_sent, reply_times[], optimal_send_window, conversation_stage, classification_history, demo_behavior, sequence_memory)
- `node_prompts` — editable system prompts for classify + all reply/follow-up nodes
- `audit_log` — actor + event + detail
- `unsubscribed_prospects` — separate suppression list
- `sequence_analytics_cache` — precomputed funnel + reply-quality + variant stats
- `ab_test_results` — per-variant enrollment/response/winner

**Column additions**
- `messages`: `is_test_data`, `classified_by`, `source` (align with spec)
- `demos` split-out view: promote key fields from current `demo_leads`/`inbox_demos` into a normalized `demos` table (existing rows migrated, old tables kept for compatibility)

**Seeds**
- `node_prompts`: classify + Positive/Negative/Objection reply + 6 follow-up trigger prompts (exact n8n text)
- `variable_fallbacks`: firstname, lastname, company, website, demo_url, sender_name, sender_email, campaign_name, days_since_demo/click/open
- `followup_rules`: 6 trigger keys with default delays

All new public tables get GRANT + RLS + policies in the same migration.

---

## Phase 2 — AI Memory Layer

- `update-prospect-memory` edge function: upserts `prospect_memory`, recalculates `optimal_send_window` (best_days/hours, confidence, timezone_guess) from `reply_times[]`
- Demo-link lock, 3 layers:
  1. Memory check before generating (skip demo link if `demo_link_sent=true`)
  2. Prompt injection: system prompt receives `NEVER_SEND_DEMO_LINK=true`
  3. Post-generation sanitizer strips any demo URL if lock is set
- Hooks: `webhook-manyreach-reply` (on incoming), `track-demo-event` (on link/open/voice/chat), `inbox-send-reply` + `followup-send` (on outgoing → set demo_link_sent) all call `update-prospect-memory`
- `process-follow-up-enrollments` reads `optimal_send_window` for smart timing (already partially wired — extend to use memory instead of activity_times directly)

---

## Phase 3 — Design System

- `src/index.css`: full token set (colors, spacing, radius, shadows, focus rings) as HSL CSS vars
- `tailwind.config.ts`: extend with brand/success/warning/danger/hot scales + shadow tokens + Inter Variable
- `src/lib/motion.ts`: springSnappy/Smooth/Gentle, StaggerContainer/Item variants, prefers-reduced-motion guard
- Component primitives (extend existing shadcn where possible, new where not):
  StatCard, Button (primary/secondary/ghost/danger + loading/success morph), Input, Badge, Table, InteractiveCard, Avatar (deterministic gradient), Modal, Drawer, Toast (sonner styled), Skeleton, EmptyState

---

## Phase 4 — Global Shell

- `AppShell` layout with collapsible sidebar (w-56 ↔ w-16) + top header
- Sidebar: 8 nav items with Framer Motion `layoutId="sidebar-pill"` active indicator
- Header: logo, `/`-focused search, `NotificationBell` (already built — restyle), avatar menu
- Wraps all admin routes; existing `AdminDashboard` becomes route host

---

## Phase 5 — Pages

Each page rebuilt against the design system. Existing panels reused where possible.

1. **`/` Dashboard Home** — greeting, 8 stat cards with 7-day trend, realtime activity feed, quick actions
2. **`/inbox`** — two-panel; list with 8 filter pills + sort; thread with Demo Journey strip, Lead Intelligence card, Hot Lead banner, smart-editor with locked demo chip, Developer View toggle showing per-message pipeline trace
3. **`/leads`** — full table (Send Window column with confidence dots), engagement filter pills, bulk actions, row → inbox
4. **`/follow-ups`** — 3 sub-tabs: Queue (kanban), Sequences (builder w/ health + preview + import/export/duplicate), Analytics (funnel, quality, heatmap, best-step, A/B, CSV)
5. **`/workflow`** — n8n-style canvas, realtime node glow on `pipeline_events`, node drawer (Logs / Prompt editor bound to `node_prompts` / Live Test), execution replay strip
6. **`/health-check`** — 11 test cards in 2-col grid, Run All progress bar, per-card JSON drawer, history table
7. **`/logs`** — 4 sub-tabs: Webhook Logs, Pipeline Events, Error Log, Credentials (webhook URL+secret, ManyReach, OpenAI/Lovable AI, Supabase keys, tracking snippet)
8. **`/settings`** — General, Variables (fallback editor), Sequences (global rules), Notifications toggles, API Keys shortcut

---

## Phase 6 — Animations

Wire motion tokens into: sidebar pill, tab indicators, stat card stagger, list/kanban stagger, page transitions (AnimatePresence mode="wait"), button loading/success morph, hot-lead banner pulse, workflow canvas dot-travel, toast stack.

---

## Technical notes

- All new edge functions get `verify_jwt = false` only where webhook-hit (webhook receivers); everything else requires auth
- Existing routes stay live until new shell replaces them — cutover happens once all 8 pages compile
- Backend contract unchanged for ManyReach; only additive
- Cron jobs already wired (evaluator/dispatcher/enrollments every 15min) — no change
- `demos` normalization: view over existing `demo_leads` + `inbox_demos` first (no data move), promote to real table only if needed for perf

---

## Out of scope

- WhatsApp source (schema supports it, no UI yet)
- Full i18n
- Mobile-native app (responsive web only)

---

## Delivery order

Phase 1 → 2 → 3 → 4 → 5 (Dashboard, Inbox, Leads, Follow-ups, Workflow, Health, Logs, Settings in that order) → 6. Roughly 40–50 files across ~6 turns. I'll pause after each phase for you to sanity-check the preview before moving on.
