-- ============================================================
-- 01 — EXTENSIONS
-- Run this FIRST on a brand new project.
-- ============================================================

SET statement_timeout = 0;
SET client_min_messages = warning;

CREATE SCHEMA IF NOT EXISTS extensions;

-- Vector search (products, property_listings, knowledge_base_entries embeddings).
-- MUST live in the public schema: column types are declared as `vector(...)`.
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- Outbound HTTP from Postgres (used by scheduled jobs calling edge functions).
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA public;

-- UUID + crypto helpers.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- Query statistics (optional, present on the source project).
CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;

-- Scheduler. On managed platforms this may need to be enabled from the
-- dashboard/integrations UI instead; the CREATE below is a no-op if already on.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- gen_random_uuid() is used as a column default across the schema.
-- It ships with pgcrypto (and core PG13+); nothing else to do here.
