create table if not exists public.manyreach_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  api_key text not null,
  active boolean not null default true,
  is_default boolean not null default false,
  webhook_secret text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists manyreach_accounts_default_idx
  on public.manyreach_accounts (is_default)
  where is_default = true;

create table if not exists public.manyreach_mailboxes (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  email text not null unique,
  manyreach_account_id uuid references public.manyreach_accounts(id) on delete restrict,
  uses_default_account boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint manyreach_mailboxes_route_check check (uses_default_account = true or manyreach_account_id is not null)
);

create index if not exists manyreach_mailboxes_account_idx
  on public.manyreach_mailboxes (manyreach_account_id);

alter table public.manyreach_accounts enable row level security;
alter table public.manyreach_mailboxes enable row level security;
