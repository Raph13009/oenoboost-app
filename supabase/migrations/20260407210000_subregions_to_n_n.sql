-- Switch the communes↔subregions relationship from 1:N to N:N.
--
-- Reality: a single commune can produce wines for multiple subregions
-- (e.g. an Alsace village is both in "Alsace" and "Alsace Grand Cru";
-- a Roussillon commune can be in both "Roussillon" and "Vins Doux Naturels").
-- Forcing 1:N dropped 379 legitimate commune↔subregion memberships.

-- 1. Drop the 1:N column (never populated — no data loss).
drop index if exists public.communes_full_subregion_id_idx;
alter table public.communes_full drop column if exists subregion_id;

-- 2. Junction table.
create table if not exists public.communes_full_subregion_link (
  commune_code_insee text    not null references public.communes_full (code_insee) on delete cascade,
  subregion_id       integer not null references public.subregions (id) on delete cascade,
  primary key (commune_code_insee, subregion_id)
);

create index if not exists communes_full_subregion_link_subregion_id_idx
  on public.communes_full_subregion_link (subregion_id);
