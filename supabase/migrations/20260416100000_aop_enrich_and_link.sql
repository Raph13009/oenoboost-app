-- Additive migration: enrich `aop` with the content columns the app reads from
-- `appellations`, create aop-side replacements for the two junctions that are
-- actively read (subregion, soil), and widen `favorites.content_id` to text so
-- it can hold integer aop ids alongside existing uuid ids for other content
-- types.
--
-- NO DROP is executed. `appellations`, `appellation_*_links`, `communes`,
-- `appellations_backup2`, `wine_subregions_backup` remain untouched as
-- historical backup.
--
-- Name-matching between `aop.name` and `appellations.name_fr` is the linchpin
-- of every backfill below. A small number of aop rows (comagri AOPs without a
-- content page, currently ~41) will not match and will retain the column
-- defaults — this is acceptable and renders as a stub on the detail page.

begin;

-- ── 1. Enrich aop ────────────────────────────────────────────────────────────

alter table public.aop
  add column if not exists slug                  varchar,
  add column if not exists area_hectares         numeric,
  add column if not exists producer_count        integer,
  add column if not exists production_volume_hl  integer,
  add column if not exists price_range_min_eur   numeric,
  add column if not exists price_range_max_eur   numeric,
  add column if not exists history_fr            text,
  add column if not exists history_en            text,
  add column if not exists colors_grapes_fr      text,
  add column if not exists colors_grapes_en      text,
  add column if not exists soils_description_fr  text,
  add column if not exists soils_description_en  text,
  add column if not exists is_premium            boolean   not null default true,
  add column if not exists status                varchar   not null default 'published'
                                                 check (status in ('draft','published','archived')),
  add column if not exists published_at          timestamp,
  add column if not exists created_at            timestamp default now(),
  add column if not exists updated_at            timestamp default now(),
  add column if not exists deleted_at            timestamp;

-- RLS: aop table is read by PostgREST from the browser with the anon key.
alter table public.aop enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policy
     where polrelid = 'public.aop'::regclass
       and polname  = 'public read aop'
  ) then
    create policy "public read aop"
      on public.aop for select using (true);
  end if;
end $$;

-- ── 2. Backfill content from appellations via name join ──────────────────────

update public.aop a
set slug                  = coalesce(a.slug, ap.slug),
    area_hectares         = ap.area_hectares,
    producer_count        = ap.producer_count,
    production_volume_hl  = ap.production_volume_hl,
    price_range_min_eur   = ap.price_range_min_eur,
    price_range_max_eur   = ap.price_range_max_eur,
    history_fr            = ap.history_fr,
    history_en            = ap.history_en,
    colors_grapes_fr      = ap.colors_grapes_fr,
    colors_grapes_en      = ap.colors_grapes_en,
    soils_description_fr  = ap.soils_description_fr,
    soils_description_en  = ap.soils_description_en,
    is_premium            = coalesce(ap.is_premium, true),
    status                = coalesce(ap.status, 'published'),
    published_at          = ap.published_at,
    created_at            = coalesce(ap.created_at, a.created_at, now()),
    updated_at            = coalesce(ap.updated_at, a.updated_at, now()),
    deleted_at            = ap.deleted_at
from public.appellations ap
where lower(trim(a.name)) = lower(trim(ap.name_fr))
  and ap.deleted_at is null;

-- ── 3. Generate slug for aop rows without an appellations match ──────────────

create extension if not exists unaccent;

update public.aop
set slug = trim(
             both '-' from
             regexp_replace(
               lower(unaccent(trim(name))),
               '[^a-z0-9]+', '-', 'g'
             )
           )
where slug is null or slug = '';

-- Abort with a clear error if any slug collision remains (requires manual fix).
do $$
declare
  dupe_count int;
begin
  select count(*) into dupe_count from (
    select slug from public.aop group by slug having count(*) > 1
  ) x;
  if dupe_count > 0 then
    raise exception 'aop slug collisions detected (% duplicate slugs). Resolve manually before re-running.', dupe_count;
  end if;
end $$;

alter table public.aop alter column slug set not null;

create unique index if not exists aop_slug_idx on public.aop (slug);

-- ── 4. aop_subregion_link (replaces appellation_subregion_links) ─────────────

create table if not exists public.aop_subregion_link (
  aop_id       integer not null references public.aop            (id) on delete cascade,
  subregion_id uuid    not null references public.wine_subregions (id) on delete cascade,
  primary key (aop_id, subregion_id)
);

create index if not exists aop_subregion_link_subregion_idx
  on public.aop_subregion_link (subregion_id);

alter table public.aop_subregion_link enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policy
     where polrelid = 'public.aop_subregion_link'::regclass
       and polname  = 'public read aop_subregion_link'
  ) then
    create policy "public read aop_subregion_link"
      on public.aop_subregion_link for select using (true);
  end if;
end $$;

insert into public.aop_subregion_link (aop_id, subregion_id)
select a.id, asl.subregion_id
  from public.appellation_subregion_links asl
  join public.appellations ap on ap.id = asl.appellation_id
  join public.aop a on lower(trim(a.name)) = lower(trim(ap.name_fr))
 where ap.deleted_at is null
on conflict do nothing;

-- ── 5. aop_soil_link (replaces appellation_soil_links) ───────────────────────

create table if not exists public.aop_soil_link (
  aop_id       integer not null references public.aop         (id) on delete cascade,
  soil_type_id uuid    not null references public.soil_types  (id) on delete cascade,
  primary key (aop_id, soil_type_id)
);

create index if not exists aop_soil_link_soil_type_idx
  on public.aop_soil_link (soil_type_id);

alter table public.aop_soil_link enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policy
     where polrelid = 'public.aop_soil_link'::regclass
       and polname  = 'public read aop_soil_link'
  ) then
    create policy "public read aop_soil_link"
      on public.aop_soil_link for select using (true);
  end if;
end $$;

insert into public.aop_soil_link (aop_id, soil_type_id)
select a.id, sl.soil_type_id
  from public.appellation_soil_links sl
  join public.appellations ap on ap.id = sl.appellation_id
  join public.aop a on lower(trim(a.name)) = lower(trim(ap.name_fr))
 where ap.deleted_at is null
on conflict do nothing;

-- ── 6. Favorites: widen content_id, rewrite 'appellation' → 'aop' ────────────

-- Drop the existing content_type CHECK first so we can freely rewrite the
-- column values. Auto-named by Postgres — look up dynamically.
do $$
declare
  old_name text;
begin
  select conname into old_name
    from pg_constraint
   where conrelid = 'public.favorites'::regclass
     and contype  = 'c'
     and pg_get_constraintdef(oid) like '%content_type%';
  if old_name is not null then
    execute format('alter table public.favorites drop constraint %I', old_name);
  end if;
end $$;

-- Widen content_id so it can hold both uuid strings and integer strings.
alter table public.favorites
  alter column content_id type text using content_id::text;

-- Re-point any existing favorite rows that point at an appellation uuid.
update public.favorites f
set content_id   = a.id::text,
    content_type = 'aop'
  from public.appellations ap
  join public.aop a on lower(trim(a.name)) = lower(trim(ap.name_fr))
 where f.content_type = 'appellation'
   and f.content_id   = ap.id::text;

-- Drop any leftover 'appellation' rows (users who favorited an AOP that has
-- no matching aop row — extremely rare / none today).
delete from public.favorites where content_type = 'appellation';

-- Add the new CHECK allowing 'aop' (and removing 'appellation').
alter table public.favorites
  add constraint favorites_content_type_check
  check (content_type in ('aop','grape','soil_type','vinification_type','dictionary_term'));

commit;
