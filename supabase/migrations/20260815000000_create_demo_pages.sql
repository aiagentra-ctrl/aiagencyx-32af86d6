-- Version-controlled schema for the demo_pages table used by
-- supabase/functions/create-demo-page and the public demo/admin pages.
-- CREATE TABLE IF NOT EXISTS keeps this safe even if the table was
-- previously created manually in the Supabase dashboard.

create table if not exists public.demo_pages (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  assistant_id text,
  business_name text,
  description text,
  vapi_key text,
  client_name text,
  company_name text,
  industry text,
  hero_title text,
  hero_subtitle text,
  calendly_url text,
  cta_text text,
  contact_email text,
  contact_phone text,
  custom_subdomain text,
  views integer default 0,
  created_at timestamptz default now()
);

alter table public.demo_pages enable row level security;

drop policy if exists "demo_pages_public_read" on public.demo_pages;
create policy "demo_pages_public_read"
  on public.demo_pages for select using (true);

drop policy if exists "demo_pages_auth_write" on public.demo_pages;
create policy "demo_pages_auth_write"
  on public.demo_pages for insert to authenticated with check (true);