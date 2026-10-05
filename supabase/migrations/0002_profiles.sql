-- 0002 — profiles: one row per user with an optional nickname (PLAN S10, 2026-10-05).
-- Run once in Supabase → SQL Editor (after 0001_init.sql). Safe to re-run.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text check (char_length(nickname) between 1 and 20 and nickname = btrim(nickname)),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- own row only: read, create, change. No delete policy — rows go with the auth user
-- (on delete cascade) or through /api/account (service role).
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());
create policy profiles_insert_own on public.profiles
  for insert with check (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

grant select, insert, update on public.profiles to authenticated;
