-- Add Grand Cru classification flag to the aop table.
-- Defaults to false; set manually via the CMS or a backfill script.
ALTER TABLE public.aop
  ADD COLUMN IF NOT EXISTS is_grand_cru boolean NOT NULL DEFAULT false;
