-- Tighten the region filter on get_aop_communes_geojson: require the AOP to
-- have at least 10% of its communes inside the region's subregion commune
-- set, not merely one shared commune. Without the threshold, large regional
-- AOPs like Bordeaux (493 communes, one of which happens to appear in a
-- Sud-Ouest subregion) leak into neighbouring regions on the map.
--
-- Threshold calibration from the current dataset:
--   Bordeaux / Bordeaux sup. / Crémant de Bordeaux → 1/493 ≈ 0.2% (noise)
--   Gaillac (legit Sud-Ouest)                      → 21/72  ≈ 29.2%
--   Bergerac (legit Sud-Ouest)                     → 81/86  ≈ 94.2%
-- 10% excludes the Bordeaux noise with plenty of headroom below Gaillac.

drop function if exists public.get_aop_communes_geojson(
  double precision, double precision, double precision, double precision, uuid
);

create or replace function public.get_aop_communes_geojson(
  min_lng      double precision,
  min_lat      double precision,
  max_lng      double precision,
  max_lat      double precision,
  region_id_in uuid default null
)
returns table (
  aop_id   integer,
  aop_name text,
  area_m2  double precision,
  geometry json
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with region_aops as (
    select cal.aop_id,
           count(*) filter (where s.region_id = region_id_in)::numeric
             / nullif(count(*), 0) as share
      from public.communes_full_aop_link cal
      left join public.communes_full_subregion_link csl
        on csl.commune_code_insee = cal.commune_code_insee
      left join public.subregions s on s.id = csl.subregion_id
     group by cal.aop_id
  )
  select
    a.id                                     as aop_id,
    a.name                                   as aop_name,
    a.area_m2                                as area_m2,
    st_asgeojson(st_union(c.geometry))::json as geometry
  from public.aop a
  join public.communes_full_aop_link l on l.aop_id = a.id
  join public.communes_full c          on c.code_insee = l.commune_code_insee
  where
    c.geometry is not null
    and c.geometry && st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    and (
      region_id_in is null
      or a.id = any (
        select aop_id from region_aops where share >= 0.10
      )
    )
  group by a.id, a.name, a.area_m2
  order by a.area_m2 desc nulls last
$$;
