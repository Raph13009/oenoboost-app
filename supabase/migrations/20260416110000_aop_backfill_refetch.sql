-- Re-run the content backfill + link backfill with a stronger name-matching
-- strategy: unaccent + replace non-alphanumerics with spaces + sort tokens
-- alphabetically. This makes "Canon-Fronsac" match "Canon Fronsac" (dash
-- normalization) and "Cadillac Côtes de Bordeaux" match "Côtes de Bordeaux
-- Cadillac" (word-order agnostic).
--
-- The previous migration (20260416100000) used a plain lower(trim) equality
-- which missed ~40% of AOPs. This migration augments what the first one did
-- — existing matches are unchanged; newly-matched rows get backfilled.

begin;

-- ── 1. Backfill additional content via the stronger match ────────────────────
-- COALESCE to avoid overwriting data that the first migration already set.

update public.aop a
set slug                  = coalesce(a.slug, ap.slug),
    area_hectares         = coalesce(a.area_hectares, ap.area_hectares),
    producer_count        = coalesce(a.producer_count, ap.producer_count),
    production_volume_hl  = coalesce(a.production_volume_hl, ap.production_volume_hl),
    price_range_min_eur   = coalesce(a.price_range_min_eur, ap.price_range_min_eur),
    price_range_max_eur   = coalesce(a.price_range_max_eur, ap.price_range_max_eur),
    history_fr            = coalesce(a.history_fr, ap.history_fr),
    history_en            = coalesce(a.history_en, ap.history_en),
    colors_grapes_fr      = coalesce(a.colors_grapes_fr, ap.colors_grapes_fr),
    colors_grapes_en      = coalesce(a.colors_grapes_en, ap.colors_grapes_en),
    soils_description_fr  = coalesce(a.soils_description_fr, ap.soils_description_fr),
    soils_description_en  = coalesce(a.soils_description_en, ap.soils_description_en),
    is_premium            = coalesce(a.is_premium, ap.is_premium),
    status                = coalesce(a.status, ap.status, 'published'),
    published_at          = coalesce(a.published_at, ap.published_at),
    deleted_at            = coalesce(a.deleted_at, ap.deleted_at)
from (
  select id, name_fr, slug, area_hectares, producer_count, production_volume_hl,
         price_range_min_eur, price_range_max_eur, history_fr, history_en,
         colors_grapes_fr, colors_grapes_en, soils_description_fr,
         soils_description_en, is_premium, status, published_at, deleted_at,
         array_to_string(array(
           select unnest(string_to_array(
             trim(regexp_replace(lower(unaccent(name_fr)), '[^a-z0-9]+', ' ', 'g')),
             ' '
           )) order by 1
         ), ' ') as norm
    from public.appellations
   where deleted_at is null
) ap
where array_to_string(array(
        select unnest(string_to_array(
          trim(regexp_replace(lower(unaccent(a.name)), '[^a-z0-9]+', ' ', 'g')),
          ' '
        )) order by 1
      ), ' ') = ap.norm;

-- ── 2. Re-populate aop_subregion_link with stronger match ────────────────────
-- on conflict do nothing so existing rows are preserved.

insert into public.aop_subregion_link (aop_id, subregion_id)
select distinct a.id, asl.subregion_id
  from public.appellation_subregion_links asl
  join public.appellations ap on ap.id = asl.appellation_id
  join public.aop a on
    array_to_string(array(
      select unnest(string_to_array(
        trim(regexp_replace(lower(unaccent(a.name)), '[^a-z0-9]+', ' ', 'g')),
        ' '
      )) order by 1
    ), ' ')
    =
    array_to_string(array(
      select unnest(string_to_array(
        trim(regexp_replace(lower(unaccent(ap.name_fr)), '[^a-z0-9]+', ' ', 'g')),
        ' '
      )) order by 1
    ), ' ')
 where ap.deleted_at is null
on conflict do nothing;

-- ── 3. Re-populate aop_soil_link with stronger match ─────────────────────────

insert into public.aop_soil_link (aop_id, soil_type_id)
select distinct a.id, sl.soil_type_id
  from public.appellation_soil_links sl
  join public.appellations ap on ap.id = sl.appellation_id
  join public.aop a on
    array_to_string(array(
      select unnest(string_to_array(
        trim(regexp_replace(lower(unaccent(a.name)), '[^a-z0-9]+', ' ', 'g')),
        ' '
      )) order by 1
    ), ' ')
    =
    array_to_string(array(
      select unnest(string_to_array(
        trim(regexp_replace(lower(unaccent(ap.name_fr)), '[^a-z0-9]+', ' ', 'g')),
        ' '
      )) order by 1
    ), ' ')
 where ap.deleted_at is null
on conflict do nothing;

commit;
