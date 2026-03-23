import { createClient } from "@/lib/supabase/server";
import type { WineSubregion } from "../types";

export async function getSubregions(
  regionId: string,
): Promise<WineSubregion[]> {
  const supabase = await createClient();
  const includeDraft = process.env.NODE_ENV !== "production";

  let query = supabase
    .from("wine_subregions")
    .select(
      "id, region_id, slug, name_fr, name_en, area_hectares, description_fr, description_en, map_order, status, created_at, updated_at, deleted_at, centroid_lat, centroid_lng, geojson, published_at",
    )
    .eq("region_id", regionId)
    .is("deleted_at", null);

  if (!includeDraft) {
    query = query.or("status.eq.published,published_at.not.is.null");
  }

  const { data, error } = await query.order("map_order", {
    ascending: true,
  });

  if (error)
    throw new Error(`Failed to fetch subregions: ${error.message}`);
  return (data ?? []) as WineSubregion[];
}

export async function getSubregionBySlug(
  slug: string,
): Promise<WineSubregion | null> {
  const supabase = await createClient();
  const includeDraft = process.env.NODE_ENV !== "production";

  let query = supabase
    .from("wine_subregions")
    .select(
      "id, region_id, slug, name_fr, name_en, area_hectares, description_fr, description_en, map_order, status, created_at, updated_at, deleted_at, centroid_lat, centroid_lng, geojson, published_at",
    )
    .eq("slug", slug)
    .is("deleted_at", null);

  if (!includeDraft) {
    query = query.or("status.eq.published,published_at.not.is.null");
  }

  const { data, error } = await query.single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to fetch subregion: ${error.message}`);
  }
  return data as WineSubregion;
}
