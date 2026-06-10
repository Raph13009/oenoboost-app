-- Add a rosé share to the AOP wine-color breakdown, alongside
-- red / white / sparkling / liqueur. The sum-to-100 CHECK must be widened to
-- include rosé, otherwise a breakdown that includes rosé could never sum to 100.
--
-- Existing rows are unaffected: where `wine_pct_rose` is NULL, COALESCE(...,0)
-- keeps the previous sum, and the "all NULL = no breakdown" case still holds.
--
-- Idempotent + transactional: safe to paste into the Supabase SQL editor and
-- re-run.

begin;

alter table public.aop
  add column if not exists wine_pct_rose smallint;

-- Range check for the new column (0–100 or NULL).
alter table public.aop
  drop constraint if exists aop_wine_pct_rose_range;
alter table public.aop
  add constraint aop_wine_pct_rose_range
    check (wine_pct_rose is null or (wine_pct_rose >= 0 and wine_pct_rose <= 100));

-- Recreate the sum constraint to include rosé.
alter table public.aop
  drop constraint if exists aop_wine_pct_sum_100;
alter table public.aop
  add constraint aop_wine_pct_sum_100
    check (
      (
        wine_pct_red is null
        and wine_pct_rose is null
        and wine_pct_white is null
        and wine_pct_sparkling is null
        and wine_pct_liqueur is null
      )
      or (
        coalesce(wine_pct_red, 0)
        + coalesce(wine_pct_rose, 0)
        + coalesce(wine_pct_white, 0)
        + coalesce(wine_pct_sparkling, 0)
        + coalesce(wine_pct_liqueur, 0)
      ) = 100
    );

comment on column public.aop.wine_pct_rose is 'Share of rosé wine production (0–100). NULL if unknown.';

commit;
