-- RPC that returns each subregion's unioned commune geometry plus its content
-- columns, scoped to a region. The map reads this instead of the pre-baked
-- wine_subregions.geojson blob, which is no longer authoritative — polygons
-- for the new integer subregions table are derived from
-- communes_full_subregion_link, the same pattern used by
-- get_aop_communes_geojson for AOPs.

create or replace function public.get_subregions_geojson_by_region(
  region_id_in uuid
)
returns table (
  id              integer,
  region_id       uuid,
  slug            text,
  name_fr         text,
  name_en         text,
  description_fr  text,
  description_en  text,
  area_hectares   numeric,
  centroid_lat    double precision,
  centroid_lng    double precision,
  color_hex       text,
  map_order       integer,
  status          varchar,
  published_at    timestamp,
  geometry        json
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select
    s.id,
    s.region_id,
    s.slug,
    s.name_fr,
    s.name_en,
    s.description_fr,
    s.description_en,
    s.area_hectares,
    s.centroid_lat,
    s.centroid_lng,
    s.color_hex,
    s.map_order,
    s.status,
    s.published_at,
    st_asgeojson(st_union(c.geometry))::json as geometry
  from public.subregions s
  join public.communes_full_subregion_link l on l.subregion_id = s.id
  join public.communes_full c                on c.code_insee   = l.commune_code_insee
  where s.region_id    = region_id_in
    and s.deleted_at is null
    and c.geometry is not null
  group by s.id
  order by coalesce(s.map_order, 2147483647), s.name_fr;
$$;
