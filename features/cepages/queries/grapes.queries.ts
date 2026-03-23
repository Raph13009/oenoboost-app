import { createClient } from "@/lib/supabase/server";
import type { Grape } from "../types";

const GRAPE_COLUMNS =
  "id, slug, name_fr, name_en, type, origin_country, origin_region_fr, origin_region_en, origin_latitude, origin_longitude, history_fr, history_en, crossings_fr, crossings_en, production_regions_fr, production_regions_en, viticultural_traits_fr, viticultural_traits_en, tasting_traits_fr, tasting_traits_en, emblematic_wines_fr, emblematic_wines_en, is_premium, status, published_at, created_at, updated_at, deleted_at";

export async function getGrapes(type?: "red" | "white") {
  const supabase = await createClient();
  const includeDraft = process.env.NODE_ENV !== "production";

  let query = supabase
    .from("grapes")
    .select(GRAPE_COLUMNS)
    .is("deleted_at", null)
    .order("name_fr", { ascending: true });

  if (type) {
    query = query.eq("type", type);
  }

  if (!includeDraft) {
    query = query.eq("status", "published").not("published_at", "is", null);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch grapes: ${error.message}`);
  return (data ?? []) as Grape[];
}

export async function getGrapeBySlug(slug: string) {
  const supabase = await createClient();
  const includeDraft = process.env.NODE_ENV !== "production";

  let query = supabase
    .from("grapes")
    .select(GRAPE_COLUMNS)
    .eq("slug", slug)
    .is("deleted_at", null);

  if (!includeDraft) {
    query = query.eq("status", "published").not("published_at", "is", null);
  }

  const { data, error } = await query.single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to fetch grape: ${error.message}`);
  }
  return data as Grape;
}
