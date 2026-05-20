-- Wine color production breakdown (percentages) per AOP.
-- All null = no breakdown data (no chart on the app). When set, values must sum to 100.

ALTER TABLE public.aop
  ADD COLUMN IF NOT EXISTS wine_pct_red smallint,
  ADD COLUMN IF NOT EXISTS wine_pct_white smallint,
  ADD COLUMN IF NOT EXISTS wine_pct_sparkling smallint,
  ADD COLUMN IF NOT EXISTS wine_pct_liqueur smallint;

ALTER TABLE public.aop
  ADD CONSTRAINT aop_wine_pct_red_range
    CHECK (wine_pct_red IS NULL OR (wine_pct_red >= 0 AND wine_pct_red <= 100)),
  ADD CONSTRAINT aop_wine_pct_white_range
    CHECK (wine_pct_white IS NULL OR (wine_pct_white >= 0 AND wine_pct_white <= 100)),
  ADD CONSTRAINT aop_wine_pct_sparkling_range
    CHECK (wine_pct_sparkling IS NULL OR (wine_pct_sparkling >= 0 AND wine_pct_sparkling <= 100)),
  ADD CONSTRAINT aop_wine_pct_liqueur_range
    CHECK (wine_pct_liqueur IS NULL OR (wine_pct_liqueur >= 0 AND wine_pct_liqueur <= 100)),
  ADD CONSTRAINT aop_wine_pct_sum_100
    CHECK (
      (
        wine_pct_red IS NULL
        AND wine_pct_white IS NULL
        AND wine_pct_sparkling IS NULL
        AND wine_pct_liqueur IS NULL
      )
      OR (
        COALESCE(wine_pct_red, 0)
        + COALESCE(wine_pct_white, 0)
        + COALESCE(wine_pct_sparkling, 0)
        + COALESCE(wine_pct_liqueur, 0)
      ) = 100
    );

COMMENT ON COLUMN public.aop.wine_pct_red IS 'Share of red wine production (0–100). NULL if unknown.';
COMMENT ON COLUMN public.aop.wine_pct_white IS 'Share of white wine production (0–100). NULL if unknown.';
COMMENT ON COLUMN public.aop.wine_pct_sparkling IS 'Share of sparkling wine production (0–100). NULL if unknown.';
COMMENT ON COLUMN public.aop.wine_pct_liqueur IS 'Share of fortified/liqueur wine production (0–100). NULL if unknown.';
