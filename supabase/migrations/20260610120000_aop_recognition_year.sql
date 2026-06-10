-- "Date AOP": the year an appellation was recognized as AOP/AOC (e.g. 1936),
-- shown in the AOP detail "Chiffres clés" box and editable from the CMS.
--
-- Stored as a year (smallint) rather than a full date: appellation recognition
-- is conventionally expressed as a year, which avoids inventing a month/day.
--
-- Idempotent + transactional: safe to paste into the Supabase SQL editor.

begin;

alter table public.aop
  add column if not exists recognition_year smallint;

alter table public.aop
  drop constraint if exists aop_recognition_year_range;
alter table public.aop
  add constraint aop_recognition_year_range
    check (
      recognition_year is null
      or (recognition_year >= 1800 and recognition_year <= 2100)
    );

comment on column public.aop.recognition_year is
  'Year the appellation was recognized as AOP/AOC (e.g. 1936). NULL if unknown.';

commit;
