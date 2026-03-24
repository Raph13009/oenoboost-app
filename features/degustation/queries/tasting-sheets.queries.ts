import { createClient } from "@/lib/supabase/server";
import type { TastingSheet } from "@/types/database";

export type TastingSheetListRow = Pick<
  TastingSheet,
  | "id"
  | "wine_name"
  | "vintage"
  | "eye_color"
  | "created_at"
  | "mouth_acidity"
  | "mouth_tannins"
  | "mouth_length_caudalie"
>;

export async function listTastingSheetsForUser(
  userId: string,
): Promise<TastingSheetListRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasting_sheets")
    .select(
      "id, wine_name, vintage, eye_color, created_at, mouth_acidity, mouth_tannins, mouth_length_caudalie",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`tasting_sheets list: ${error.message}`);
  }

  return (data ?? []) as TastingSheetListRow[];
}

export async function getTastingSheetByIdForUser(
  id: string,
  userId: string,
): Promise<TastingSheet | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasting_sheets")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`tasting_sheets get: ${error.message}`);
  }

  if (!data) return null;

  const row = data as Record<string, unknown>;
  const families = row.nose_aroma_families;
  return {
    ...(data as TastingSheet),
    nose_aroma_families: Array.isArray(families)
      ? (families as string[])
      : null,
  };
}
