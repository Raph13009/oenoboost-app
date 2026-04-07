-- Enable PostGIS for geometry support
create extension if not exists postgis with schema extensions;

-- Full communes table with geometry
-- code_insee is the natural unique key (5-char INSEE code), used directly as PK
create table if not exists public.communes_full (
  code_insee text primary key,
  name       text not null,
  geometry   geometry(Geometry, 4326)
);

create index if not exists communes_full_geometry_idx
  on public.communes_full using gist (geometry);

-- AOP (Appellation d'Origine Protégée) table
-- id matches IDA from comagri source data
create table if not exists public.aop (
  id   integer primary key,
  name text not null
);

-- Many-to-many link between communes and AOPs
create table if not exists public.communes_full_aop_link (
  commune_code_insee text    not null references public.communes_full (code_insee) on delete cascade,
  aop_id             integer not null references public.aop (id) on delete cascade,
  primary key (commune_code_insee, aop_id)
);

create index if not exists communes_full_aop_link_aop_idx
  on public.communes_full_aop_link (aop_id);
