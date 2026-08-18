# Recovery Manifest

Inventory of everything the product needs on the backend side. Captured from the
production project at backup time. Update this file whenever backend objects change.

## Object counts (baseline enforced by `sql/99_verify.sql`)

| Object | Count |
| --- | --- |
| Tables (public) | 55 |
| Custom DB functions (public, non-extension) | 16 |
| Triggers (public) | 25 |
| RLS policies (public) | 126 |
| Indexes | 52 |
| Foreign keys | 28 |
| Storage buckets | 0 |
| Edge functions | 53 (+ `_shared` library) |

## Extensions

`vector` (public — required, column types depend on it), `pg_net` (public),
`pgcrypto`, `uuid-ossp`, `pg_stat_statements` (extensions schema), `pg_cron`.

## SQL files

| File | Contents |
| --- | --- |
| `sql/01_extensions.sql` | Extensions + `extensions` schema |
| `sql/02_schema.sql` | All tables, defaults, PK/FK/unique constraints, indexes |
| `sql/03_functions.sql` | All custom DB functions |
| `sql/04_triggers.sql` | All triggers |
| `sql/05_grants_rls.sql` | GRANTs, `ENABLE ROW LEVEL SECURITY`, all policies, default ACLs |
| `sql/06_storage.sql` | Storage buckets/policies (none today — documented) |
| `sql/07_seed_config.sql` | Configuration/content rows required for the product to function |
| `sql/99_verify.sql` | Fails loudly if anything above is missing |

## Seeded configuration tables (`07_seed_config.sql`)

`reply_templates`, `inbox_prompts`, `node_prompts`, `follow_up_templates`,
`followup_rules`, `followup_settings`, `follow_up_sequences_templates`,
`follow_up_steps`, `variable_fallbacks`, `industry_templates`, `site_settings`,
`ecommerce_landing_template`.

Deliberately **not** included (operational data, not system configuration):
`prospects`, `inbox_messages`, `inbox_demos`, `demo_pages`, `chatbots`, `products`,
`property_listings`, `knowledge_base_entries`, `link_events`, `demo_jobs`, logs,
analytics caches. Also excluded for security: `api_providers` (holds API keys) and
`webhook_endpoints` (holds webhook tokens) — recreate these from the admin panel.

## Key database functions

Follow-up / inbox automation: `cancel_followups_on_reply`, `cancel_followups_on_booking`,
`on_incoming_message_track`, `on_link_event_track_prospect`, `mirror_demo_lead_to_prospect`,
`get_best_send_time`.
Search: `match_products`, `match_products_hybrid`, `match_listings_hybrid`, `match_kb_entries`.
Infrastructure: `try_acquire_pipeline_lock`, `release_pipeline_lock`,
`touch_updated_at_generic`, `touch_updated_at_inbox`, `touch_demo_leads_updated_at`,
`update_leads_updated_at`.

## Edge functions (deploy from `supabase/functions/`)

Admin/dashboard: `admin-data`, `run-health-check`, `get-secret-status`, `get-webhook-url`,
`manage-webhook-endpoints`, `mark-notification-read`, `export-sequence-csv`,
`get-sequence-analytics`, `get-best-send-time`, `retry-demo-job`.

Demo/agent creation: `create-demo`, `create-demo-page`, `create-chatbot`, `create-ai-agent`,
`create-ai-system`, `create-voice-agent`, `generate-website`, `generate-voice-prompt`,
`deploy-to-netlify`, `scrape-and-analyze`, `scrape-ecommerce-products`,
`scrape-realestate-listings`, `build-knowledge-base`, `search-knowledge-base`,
`classify-realestate-business`.

Chat/product: `chatbot-conversation`, `recommend-products`, `analyze-chat-session`,
`generate-prompt-improvements`.

Inbox pipeline: `inbox-process-incoming`, `inbox-classify`, `inbox-generate-reply`,
`inbox-send-reply`, `inbox-manual-reply`, `inbox-actions`, `inbox-history`,
`inbox-dev-test-webhook`, `manyreach-proxy`, `update-prospect-memory`.

Follow-ups: `followup-dispatcher`, `followup-evaluator`, `followup-generate`,
`followup-send`, `process-follow-up-enrollments`, `process-email-queue`,
`trigger-follow-up`, `resume-hot-lead-sequence`.

Tracking: `track-event`, `track-visitor`, `track-chat-event`.

**Public / unauthenticated endpoints** (must stay reachable without a JWT):
`webhook-manyreach-reply`, `mr` (short webhook alias), `hook`, `track-event`,
`track-visitor`, `track-chat-event`, `chatbot-conversation`, `recommend-products`,
`search-knowledge-base`.

## Secrets required by edge functions

| Secret | Used by | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | all | auto-provided by the platform |
| `SUPABASE_SERVICE_ROLE_KEY` | all service-role reads/writes | auto-provided |
| `SUPABASE_ANON_KEY` | function-to-function invokes | auto-provided |
| `OPENROUTER_API_KEY` | classification, reply generation, prompts | required |
| `LOVABLE_API_KEY` | AI gateway calls | auto-provided |
| `FIRECRAWL_API_KEY` | all scraping; demo creation hard-gates on it | required |
| `VAPI_API_KEY` | voice agent creation | required |
| `MANYREACH_API_KEY` | outbound replies/follow-ups | required |
| `INBOX_WEBHOOK_SECRET` | inbound webhook auth | required |
| `NETLIFY_API_TOKEN`, `NETLIFY_SITE_ID` | demo site deploys | required |
| `SITE_URL`, `SITE_DOMAIN` | demo/tracking link building | required |
| `ADMIN_PANEL_PASSWORD` | `admin-data` gate | defaults in code if unset |

## Frontend environment variables (`.env`)

`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`.
Also update `project_id` in `supabase/config.toml`.

## External systems to re-point after a restore

- **ManyReach** — inbound reply webhook URL contains the project ref; recreate the
  endpoint token in the admin panel and update the URL in ManyReach.
- **VAPI** — assistants live in VAPI, not in the database; existing demos keep working,
  new ones are created on demand.
- **Netlify** — deploy target is unchanged unless the site is recreated.
- **Firecrawl** — reconnect the integration / re-add the API key.
- **Scheduled jobs (pg_cron)** — the source project's cron schema is not readable by the
  backup role. After restore, re-create the schedules that invoke
  `process-follow-up-enrollments`, `followup-dispatcher` and `process-email-queue`
  (or drive them from an external scheduler).
