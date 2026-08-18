# Disaster Recovery — restore the whole backend on a fresh project

If the current backend is lost, deleted or broken, this folder rebuilds it.

**The short version**

1. Create a new backend project.
2. Run `recovery/restore.sh` against its database.
3. Put the new URL + keys in `.env`.
4. Redeploy the edge functions and re-add the secrets.
5. Re-point the ManyReach webhook.

The product then works again with the same features.

---

## What's in here

```text
recovery/
  README.md            this guide
  MANIFEST.md          full inventory: objects, functions, secrets, integrations
  restore.sh           runs every SQL file in the right order
  sql/
    01_extensions.sql  pgvector, pg_net, pgcrypto, uuid-ossp, pg_cron
    02_schema.sql      55 tables + constraints + indexes
    03_functions.sql   16 custom database functions
    04_triggers.sql    25 triggers
    05_grants_rls.sql  grants, RLS enablement, 126 policies
    06_storage.sql     storage buckets (none today — documented)
    07_seed_config.sql prompts, templates, follow-up rules, settings
    99_verify.sql      fails loudly if anything is missing
```

The SQL is generated from the live production database, so it is the real schema —
not a hand-written approximation.

---

## Step-by-step restore

### 1. Create the new project

Create a fresh backend project and note three things: the **project ref**, the
**project URL**, and the **publishable (anon) key**. You also need the **database
connection string** (`postgresql://postgres:PASSWORD@db.<ref>...:5432/postgres`).

### 2. Restore the database

```bash
./recovery/restore.sh "postgresql://postgres:PASSWORD@db.<new-ref>.supabase.co:5432/postgres"
```

It runs the files in order and stops at the first error. The last file,
`99_verify.sql`, prints the object counts and raises an exception if any table,
function, trigger, policy, grant or RLS flag is missing. A clean run ends with:

```
NOTICE:  RESTORE VERIFIED OK ...
=== RESTORE COMPLETE ===
```

To run a single file manually:

```bash
psql "$DB_URL" -v ON_ERROR_STOP=1 -f recovery/sql/02_schema.sql
```

### 3. Point the frontend at the new project

Edit `.env` in the repo root:

```
VITE_SUPABASE_URL="https://<new-ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<new publishable key>"
VITE_SUPABASE_PROJECT_ID="<new-ref>"
```

And `supabase/config.toml`:

```
project_id = "<new-ref>"
```

That's the only code change required. Nothing else in the frontend hardcodes the
project — everything imports the client from `src/integrations/supabase/client.ts`,
which reads these variables.

### 4. Deploy the edge functions

All 53 functions already live in `supabase/functions/` in this repo and deploy with
the project. If you are deploying by hand:

```bash
supabase link --project-ref <new-ref>
supabase functions deploy --no-verify-jwt
```

Public endpoints that must stay reachable without a JWT are listed in `MANIFEST.md`
(webhooks, tracking, chatbot, product search).

### 5. Re-add the secrets

The functions read these from the environment. `MANIFEST.md` has the full table with
what uses what. Minimum set for full functionality:

`OPENROUTER_API_KEY`, `FIRECRAWL_API_KEY`, `VAPI_API_KEY`, `MANYREACH_API_KEY`,
`INBOX_WEBHOOK_SECRET`, `NETLIFY_API_TOKEN`, `NETLIFY_SITE_ID`, `SITE_URL`,
`SITE_DOMAIN`, `ADMIN_PANEL_PASSWORD`.

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` and `LOVABLE_API_KEY`
are provided automatically by the platform — do not set them manually.

### 6. Auth configuration

The admin panel authenticates with a shared admin key (`ADMIN_PANEL_PASSWORD`), not
end-user accounts, so there are no users to migrate. On the new project:

- Set the **Site URL** to the published app URL.
- Add the preview and published URLs to **Redirect URLs**.
- Leave email signups and social providers **off** unless you add end-user auth later.
- Email confirmation stays enabled (default).

### 7. Re-point the external integrations

- **ManyReach**: create a new webhook endpoint in the admin panel (Inbox → Webhooks),
  copy the generated URL, and paste it into ManyReach. The old URL contains the old
  project ref and will be dead.
- **Firecrawl**: reconnect the integration or re-add `FIRECRAWL_API_KEY`. Demo creation
  hard-gates on Firecrawl, so demos fail fast until this is done.
- **API providers**: `api_providers` (fallback LLM/scraper keys) is intentionally not
  seeded, because it stores API keys. Re-add entries in Settings → API Providers.
- **Scheduled jobs**: recreate the cron schedules that invoke
  `process-follow-up-enrollments`, `followup-dispatcher` and `process-email-queue`.

### 8. Confirm it works

Open the admin panel → **Health** and run the health check. Every group
(Integrations / Pipeline / Memory / Data) should come back green. Then:

- Dashboard loads with real counts.
- Inbox and Conversations load (these go through the service-role `admin-data` function).
- Create a test demo — it should scrape, build the chatbot and return a link.

---

## What is *not* restored

`07_seed_config.sql` restores **configuration**, not **history**. Leads, messages,
demos, chatbots, products, listings, tracking events and logs are not included — a
disaster restore gives you a working system, not last week's inbox.

If you also need the data and the old database is still readable:

```bash
# export from the old project
pg_dump "$OLD_DB_URL" --data-only --no-owner --schema=public \
  --exclude-table=public.schema_migrations > data_backup.sql

# import into the new one, after the schema restore above
psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 -f data_backup.sql
```

Two tables are excluded from the seed on purpose because they hold credentials:
`api_providers` (API keys) and `webhook_endpoints` (webhook tokens). Recreate both
from the admin panel.

---

## Keeping this package current

Whenever you change the backend — a new table, policy, trigger or function —
regenerate the SQL so the recovery package doesn't drift:

```bash
pg_dump "$SUPABASE_DB_URL" --schema-only --schema=public --no-owner --no-comments -f full.sql
```

then re-split it into `sql/02` … `sql/05` and update the counts in `MANIFEST.md` and
the thresholds in `sql/99_verify.sql`.
