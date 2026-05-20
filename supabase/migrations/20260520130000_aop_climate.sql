-- Climate description per AOP (bilingual editorial content).

ALTER TABLE public.aop
  ADD COLUMN IF NOT EXISTS climate_fr text,
  ADD COLUMN IF NOT EXISTS climate_en text;

COMMENT ON COLUMN public.aop.climate_fr IS 'Climate overview for the AOP (French). NULL = section hidden on the public page.';
COMMENT ON COLUMN public.aop.climate_en IS 'Climate overview for the AOP (English). NULL = section hidden on the public page.';
