-- New subregions table. Uses integer ids (not uuid), a single `name` column
-- (no en/fr split), and reuses the existing wine_regions.id uuid FK.
-- Geometry is NOT stored on the row — it will be derived from the union of
-- the linked communes' geometries, the same pattern the AOP layer uses.
create table if not exists public.subregions (
  id        integer generated always as identity primary key,
  region_id uuid    not null references public.wine_regions (id) on delete restrict,
  name      text    not null
);

create index if not exists subregions_region_id_idx
  on public.subregions (region_id);

-- Each commune can belong to at most one subregion (1:N from subregion →
-- communes). Nullable: not every French commune is part of a wine subregion.
-- ON DELETE SET NULL so removing a subregion doesn't cascade-delete communes.
alter table public.communes_full
  add column if not exists subregion_id integer
    references public.subregions (id) on delete set null;

create index if not exists communes_full_subregion_id_idx
  on public.communes_full (subregion_id);
