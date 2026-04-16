-- Performance fix for get_aop_communes_geojson's region filter. The previous
-- version used a correlated EXISTS which Postgres re-evaluated per-AOP and
-- timed out under the default statement_timeout. Rewrite as an uncorrelated
-- `= ANY (subquery)` so the region→AOP set is materialized once per call.

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
        select distinct cal.aop_id
          from public.communes_full_aop_link cal
          join public.communes_full_subregion_link csl
            on csl.commune_code_insee = cal.commune_code_insee
          join public.subregions s on s.id = csl.subregion_id
         where s.region_id = region_id_in
      )
    )
  group by a.id, a.name, a.area_m2
  order by a.area_m2 desc nulls last
$$;
