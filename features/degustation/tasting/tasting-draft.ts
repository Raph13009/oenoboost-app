import type { TastingSheetInsert } from "@/types/database";

/** Brouillon UI (millésime saisi en string, converti en nombre à l’enregistrement). */
export type TastingDraft = Omit<
  TastingSheetInsert,
  "wine_name" | "vintage"
> & {
  wine_name: string;
  vintage: string;
};

export function createEmptyTastingDraft(): TastingDraft {
  return {
    wine_name: "",
    vintage: "",
    eye_color: null,
    eye_robe: null,
    eye_intensity: null,
    eye_tears: null,
    eye_notes: null,
    nose_first_nose: null,
    nose_second_nose: null,
    nose_aroma_families: [],
    nose_intensity: null,
    nose_notes: null,
    mouth_attack: null,
    mouth_mid: null,
    mouth_finish: null,
    mouth_acidity: 5,
    mouth_tannins: 5,
    mouth_alcohol: 5,
    mouth_sugar: 5,
    mouth_length_caudalie: 5,
    mouth_notes: null,
  };
}

export function draftToInsert(d: TastingDraft): TastingSheetInsert & {
  wine_name: string | null;
  vintage: number | null;
} {
  const v = d.vintage.trim();
  const year = v ? parseInt(v, 10) : NaN;
  const { wine_name: wn, vintage: _v, ...rest } = d;
  return {
    ...rest,
    wine_name: wn.trim() || null,
    vintage: Number.isFinite(year) ? year : null,
    nose_aroma_families: d.nose_aroma_families ?? [],
  };
}

export const STORAGE_KEY = "oenoboost-tasting-draft-v1";
