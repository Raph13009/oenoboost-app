-- RPC: return AOPs with server-side ST_Union of commune geometries within a bounding box.
-- One row per AOP; geometry is the GeoJSON of all linked communes merged together.
create or replace function public.get_aop_communes_geojson(
  min_lng double precision,
  min_lat double precision,
  max_lng double precision,
  max_lat double precision
)
returns table (
  aop_id   integer,
  aop_name text,
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
    st_asgeojson(st_union(c.geometry))::json as geometry
  from public.aop a
  join public.communes_full_aop_link l on l.aop_id = a.id
  join public.communes_full c          on c.code_insee = l.commune_code_insee
  where
    c.geometry is not null
    and c.geometry && st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
  group by a.id, a.name
$$;
