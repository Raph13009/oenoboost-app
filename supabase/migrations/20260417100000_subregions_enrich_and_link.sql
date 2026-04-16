-- Migrate the map and all subregion-reading code off public.wine_subregions
-- onto public.subregions (integer id). The new subregions table was created
-- in 20260407200000 and populated in 20260407220000 from the comagri
-- commune ↔ subregion CSV, but had only (id, region_id, name). This migration:
--
--   1. Enriches public.subregions with the content columns previously read
--      from public.wine_subregions (slug, name_fr/en, description_fr/en,
--      area_hectares, centroid_lat/lng, color_hex, map_order, status,
--      published_at, lifecycle timestamps).
--   2. Backfills those columns from public.wine_subregions via a token-sort
--      name-match (same normalization used in 20260416110000 for AOPs).
--   3. Computes area_hectares from ST_Union(communes_full.geometry) via
--      communes_full_subregion_link for any rows not matched above.
--   4. Rebuilds public.aop_subregion_link.subregion_id from uuid
--      (→ wine_subregions) to integer (→ subregions), translating the
--      existing rows through the same token-sort join.
--   5. Enables RLS and adds a public-read policy on public.subregions.
--
-- wine_subregions remains intact as a backup; no code reads from it after
-- this migration. A future cleanup migration may drop it + wine_subregions_backup.

begin;

create extension if not exists unaccent;

-- ── 1. Enrich public.subregions ──────────────────────────────────────────────

alter table public.subregions
  add column if not exists slug             text,
  add column if not exists name_fr          text,
  add column if not exists name_en          text,
  add column if not exists description_fr   text,
  add column if not exists description_en   text,
  add column if not exists area_hectares    numeric,
  add column if not exists centroid_lat     double precision,
  add column if not exists centroid_lng     double precision,
  add column if not exists color_hex        text,
  add column if not exists map_order        integer,
  add column if not exists status           varchar   not null default 'published'
                                                      check (status in ('draft','published','archived')),
  add column if not exists published_at     timestamp,
  add column if not exists created_at       timestamp default now(),
  add column if not exists updated_at       timestamp default now(),
  add column if not exists deleted_at       timestamp;

-- ── 2. Backfill content from wine_subregions via token-sort name-match ───────
-- Same normalization as 20260416110000: unaccent + non-alphanumeric → space +
-- token sort, to absorb punctuation and word-order differences. Joined on
-- (region_id, normalized name) so subregions sharing a name across regions
-- (rare) don't cross-pollinate.

update public.subregions s
set slug           = coalesce(s.slug, ws.slug),
    name_fr        = coalesce(s.name_fr, ws.name_fr),
    name_en        = coalesce(s.name_en, ws.name_en),
    description_fr = coalesce(s.description_fr, ws.description_fr),
    description_en = coalesce(s.description_en, ws.description_en),
    area_hectares  = coalesce(s.area_hectares, ws.area_hectares),
    centroid_lat   = coalesce(s.centroid_lat, ws.centroid_lat),
    centroid_lng   = coalesce(s.centroid_lng, ws.centroid_lng),
    map_order      = coalesce(s.map_order, ws.map_order),
    status         = coalesce(ws.status, s.status),
    published_at   = coalesce(s.published_at, ws.published_at),
    created_at     = coalesce(ws.created_at, s.created_at, now()),
    updated_at     = coalesce(ws.updated_at, s.updated_at, now()),
    deleted_at     = coalesce(s.deleted_at, ws.deleted_at)
from public.wine_subregions ws
where ws.region_id = s.region_id
  and ws.deleted_at is null
  and array_to_string(array(
        select unnest(string_to_array(
          trim(regexp_replace(lower(unaccent(ws.name_fr)), '[^a-z0-9]+', ' ', 'g')),
          ' '
        )) order by 1
      ), ' ')
      =
      array_to_string(array(
        select unnest(string_to_array(
          trim(regexp_replace(lower(unaccent(s.name)), '[^a-z0-9]+', ' ', 'g')),
          ' '
        )) order by 1
      ), ' ');

-- ── 3. Defaults for subregions with no wine_subregions match ─────────────────
-- Fall back to the raw comagri `name` (always French) for both locales; slug
-- is generated from it with the usual unaccent + regex pattern.

update public.subregions
set name_fr = coalesce(name_fr, name),
    name_en = coalesce(name_en, name_fr, name);

update public.subregions
set slug = trim(
             both '-' from
             regexp_replace(
               lower(unaccent(trim(coalesce(name_fr, name)))),
               '[^a-z0-9]+', '-', 'g'
             )
           )
where slug is null or slug = '';

do $$
declare
  dupe_count int;
begin
  select count(*) into dupe_count from (
    select slug from public.subregions group by slug having count(*) > 1
  ) x;
  if dupe_count > 0 then
    raise exception 'subregions slug collisions detected (% duplicate slugs). Resolve manually before re-running.', dupe_count;
  end if;
end $$;

-- ── 4. Compute area_hectares from communes geometry for unmatched rows ──────

update public.subregions s
set area_hectares = sub.hectares
from (
  select l.subregion_id,
         st_area(st_union(c.geometry)::geography) / 10000.0 as hectares
    from public.communes_full_subregion_link l
    join public.communes_full c on c.code_insee = l.commune_code_insee
   where c.geometry is not null
   group by l.subregion_id
) sub
where s.id = sub.subregion_id
  and s.area_hectares is null;

-- ── 5. Enforce NOT NULL + uniqueness ─────────────────────────────────────────

alter table public.subregions alter column slug    set not null;
alter table public.subregions alter column name_fr set not null;
alter table public.subregions alter column name_en set not null;

create unique index if not exists subregions_slug_idx    on public.subregions (slug);
create index        if not exists subregions_status_idx  on public.subregions (status);

-- ── 6. RLS + public read policy ──────────────────────────────────────────────

alter table public.subregions enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policy
     where polrelid = 'public.subregions'::regclass
       and polname  = 'public read subregions'
  ) then
    create policy "public read subregions"
      on public.subregions for select using (true);
  end if;
end $$;

-- ── 7. Rebuild aop_subregion_link with integer subregion_id ──────────────────
-- Translate each existing uuid link (→ wine_subregions) to the new integer
-- subregion id via the same token-sort match. Rows that don't translate are
-- dropped — those are wine_subregions whose name has no counterpart in the
-- authoritative subregions table populated from comagri.

alter table public.aop_subregion_link
  add column if not exists subregion_id_int integer;

update public.aop_subregion_link l
set subregion_id_int = s.id
from public.wine_subregions ws
join public.subregions s on
  ws.region_id = s.region_id
  and array_to_string(array(
        select unnest(string_to_array(
          trim(regexp_replace(lower(unaccent(ws.name_fr)), '[^a-z0-9]+', ' ', 'g')),
          ' '
        )) order by 1
      ), ' ')
      =
      array_to_string(array(
        select unnest(string_to_array(
          trim(regexp_replace(lower(unaccent(s.name_fr)), '[^a-z0-9]+', ' ', 'g')),
          ' '
        )) order by 1
      ), ' ')
where ws.id = l.subregion_id;

do $$
declare
  total_before int;
  unmatched    int;
begin
  select count(*) into total_before from public.aop_subregion_link;
  select count(*) into unmatched    from public.aop_subregion_link where subregion_id_int is null;
  raise notice 'aop_subregion_link rebuild: % rows total, % unmatched (dropped), % translated',
    total_before, unmatched, total_before - unmatched;
end $$;

delete from public.aop_subregion_link where subregion_id_int is null;

alter table public.aop_subregion_link
  drop constraint aop_subregion_link_pkey;
alter table public.aop_subregion_link
  drop constraint if exists aop_subregion_link_subregion_id_fkey;
drop index if exists public.aop_subregion_link_subregion_idx;

alter table public.aop_subregion_link drop column subregion_id;
alter table public.aop_subregion_link rename column subregion_id_int to subregion_id;
alter table public.aop_subregion_link alter column subregion_id set not null;

alter table public.aop_subregion_link
  add constraint aop_subregion_link_pkey primary key (aop_id, subregion_id);

alter table public.aop_subregion_link
  add constraint aop_subregion_link_subregion_id_fkey
    foreign key (subregion_id) references public.subregions (id) on delete cascade;

create index if not exists aop_subregion_link_subregion_idx
  on public.aop_subregion_link (subregion_id);

commit;
