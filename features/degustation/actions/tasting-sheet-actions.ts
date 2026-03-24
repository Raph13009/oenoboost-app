"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { TastingSheetInsert } from "@/types/database";

export type SaveTastingResult =
  | { ok: true; id: string }
  | { ok: false; error: "AUTH_REQUIRED" | "DB_ERROR"; message?: string };

export async function saveTastingSheetAction(
  payload: TastingSheetInsert & { wine_name?: string | null; vintage?: number | null },
): Promise<SaveTastingResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return { ok: false, error: "AUTH_REQUIRED" };
  }

  const row = {
    user_id: user.id,
    eye_color: payload.eye_color,
    eye_robe: payload.eye_robe,
    eye_intensity: payload.eye_intensity,
    eye_tears: payload.eye_tears,
    eye_notes: payload.eye_notes,
    nose_first_nose: payload.nose_first_nose,
    nose_second_nose: payload.nose_second_nose,
    nose_aroma_families: payload.nose_aroma_families ?? [],
    nose_intensity: payload.nose_intensity,
    nose_notes: payload.nose_notes,
    mouth_attack: payload.mouth_attack,
    mouth_mid: payload.mouth_mid,
    mouth_finish: payload.mouth_finish,
    mouth_acidity: payload.mouth_acidity,
    mouth_tannins: payload.mouth_tannins,
    mouth_alcohol: payload.mouth_alcohol,
    mouth_sugar: payload.mouth_sugar,
    mouth_length_caudalie: payload.mouth_length_caudalie,
    mouth_notes: payload.mouth_notes,
    wine_name: payload.wine_name ?? null,
    vintage: payload.vintage ?? null,
  };

  const { data, error } = await supabase
    .from("tasting_sheets")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    return {
      ok: false,
      error: "DB_ERROR",
      message: error.message,
    };
  }

  revalidatePath("/profil");
  revalidatePath("/degustation/history");
  revalidatePath(`/degustation/history/${data.id}`);
  return { ok: true, id: data.id as string };
}
