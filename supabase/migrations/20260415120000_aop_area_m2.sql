-- Precompute each AOP's total geodesic area (m²) so the map RPC can return
-- rows pre-sorted without per-request recomputation, and so render ordering
-- reflects each AOP's intrinsic size — independent of the viewport bbox
-- (otherwise a regional AOP panned partially off-screen could appear smaller
-- than a village AOP and paint on top of it, breaking the "small on top"
-- invariant used by the client hit-test).
--
-- This is canonical reference data from comagri and is effectively immutable.
-- Any future migration that mutates public.communes_full_aop_link must
-- refresh public.aop.area_m2 with the same backfill pattern below.

alter table public.aop
  add column if not exists area_m2 double precision;

update public.aop a
set    area_m2 = sub.area_m2
from  (
  select l.aop_id,
         st_area(st_union(c.geometry)::geography) as area_m2
  from   public.communes_full_aop_link l
  join   public.communes_full c on c.code_insee = l.commune_code_insee
  where  c.geometry is not null
  group by l.aop_id
) sub
where a.id = sub.aop_id;

create index if not exists aop_area_m2_idx on public.aop (area_m2 desc);

-- Update the map RPC: return area_m2 and order by it server-side so the
-- client receives AOPs largest-first. Mapbox paints fill features in source
-- order (later on top), so this makes smaller AOPs paint — and stay
-- clickable — on top of larger ones.
--
-- DROP before CREATE because the returned-table shape is changing (added
-- `area_m2`), which `create or replace function` cannot do in-place.
drop function if exists public.get_aop_communes_geojson(
  double precision, double precision, double precision, double precision
);

create or replace function public.get_aop_communes_geojson(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision
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
  group by a.id, a.name, a.area_m2
  order by a.area_m2 desc nulls last
$$;
