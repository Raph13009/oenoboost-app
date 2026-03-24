-- Fiches de dégustation (sessions persistées côté app après complétion)

CREATE TABLE IF NOT EXISTS public.tasting_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  eye_color VARCHAR(100),
  eye_robe VARCHAR(100),
  eye_intensity VARCHAR(50),
  eye_tears VARCHAR(50),
  eye_notes TEXT,
  nose_first_nose TEXT,
  nose_second_nose TEXT,
  nose_aroma_families JSONB DEFAULT '[]'::jsonb,
  nose_intensity VARCHAR(50),
  nose_notes TEXT,
  mouth_attack VARCHAR(50),
  mouth_mid VARCHAR(50),
  mouth_finish VARCHAR(50),
  mouth_acidity INTEGER CHECK (mouth_acidity IS NULL OR (mouth_acidity >= 1 AND mouth_acidity <= 10)),
  mouth_tannins INTEGER CHECK (mouth_tannins IS NULL OR (mouth_tannins >= 1 AND mouth_tannins <= 10)),
  mouth_alcohol INTEGER CHECK (mouth_alcohol IS NULL OR (mouth_alcohol >= 1 AND mouth_alcohol <= 10)),
  mouth_sugar INTEGER CHECK (mouth_sugar IS NULL OR (mouth_sugar >= 1 AND mouth_sugar <= 10)),
  mouth_length_caudalie INTEGER CHECK (
    mouth_length_caudalie IS NULL OR (mouth_length_caudalie >= 1 AND mouth_length_caudalie <= 10)
  ),
  mouth_notes TEXT,
  wine_name VARCHAR(255),
  vintage INTEGER CHECK (vintage IS NULL OR (vintage >= 1700 AND vintage <= 2100)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasting_sheets_user ON public.tasting_sheets (user_id);

ALTER TABLE public.tasting_sheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasting_sheets_select_own"
  ON public.tasting_sheets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "tasting_sheets_insert_own"
  ON public.tasting_sheets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tasting_sheets_update_own"
  ON public.tasting_sheets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tasting_sheets_delete_own"
  ON public.tasting_sheets FOR DELETE
  USING (auth.uid() = user_id);
