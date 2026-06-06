-- Quantia — Supabase schema for accounts (auth + saved analyses + job description).
-- Run this in the Supabase SQL editor once. Row-Level Security guarantees each user can only ever
-- read/write their OWN rows — there is no way for one account to see another's data.

-- ── profiles: one row per user, holds the job/role description that sharpens the AI ──────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  job_description text default '',
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles are private to the owner" on public.profiles;
create policy "profiles are private to the owner"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ── analyses: a user's saved dashboards (compressed) ─────────────────────────────────────────────
create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  domain text,
  row_count integer,
  payload text not null,        -- gzip+base64url compressed DashboardSpec
  table_payload text not null,  -- gzip+base64url compressed raw/cleaned Table
  created_at timestamptz default now()
);

create index if not exists analyses_user_idx on public.analyses (user_id, created_at desc);

alter table public.analyses enable row level security;

drop policy if exists "analyses are private to the owner" on public.analyses;
create policy "analyses are private to the owner"
  on public.analyses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
