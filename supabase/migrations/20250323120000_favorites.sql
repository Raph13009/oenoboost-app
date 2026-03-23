-- Favorites (grapes and future content types)
-- Run in Supabase SQL editor if migrations are not applied automatically.

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  content_type text not null,
  content_id uuid not null,
  module text not null,
  created_at timestamptz not null default now(),
  constraint favorites_user_content_unique unique (user_id, content_type, content_id)
);

create index if not exists favorites_user_id_idx on public.favorites (user_id);
create index if not exists favorites_content_idx on public.favorites (content_type, content_id);

alter table public.favorites enable row level security;

create policy "Users can select own favorites"
  on public.favorites
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own favorites"
  on public.favorites
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can delete own favorites"
  on public.favorites
  for delete
  to authenticated
  using (auth.uid() = user_id);
