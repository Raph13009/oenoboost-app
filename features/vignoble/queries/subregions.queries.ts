import { createClient } from "@/lib/supabase/server";
import type { Subregion } from "../types";

const SUBREGION_COLUMNS =
  "id, region_id, slug, name_fr, name_en, description_fr, description_en, area_hectares, centroid_lat, centroid_lng, color_hex, map_order, status, published_at, created_at, updated_at, deleted_at";

export async function getSubregions(regionId: string): Promise<Subregion[]> {
  const supabase = await createClient();

  const query = supabase
    .from("subregions")
    .select(SUBREGION_COLUMNS)
    .eq("region_id", regionId)
    .is("deleted_at", null);

  const { data, error } = await query.order("map_order", {
    ascending: true,
  });

  if (error) throw new Error(`Failed to fetch subregions: ${error.message}`);
  return (data ?? []) as Subregion[];
}

export async function getSubregionBySlug(
  slug: string,
): Promise<Subregion | null> {
  const supabase = await createClient();

  const query = supabase
    .from("subregions")
    .select(SUBREGION_COLUMNS)
    .eq("slug", slug)
    .is("deleted_at", null);

  const { data, error } = await query.single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to fetch subregion: ${error.message}`);
  }
  return data as Subregion;
}
