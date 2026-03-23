import { createClient } from "@/lib/supabase/server";
import type { WineRegion } from "../types";

export async function getRegions(): Promise<WineRegion[]> {
  const supabase = await createClient();
  const includeDraft = process.env.NODE_ENV !== "production";

  let query = supabase
    .from("wine_regions")
    .select(
      "id, slug, name_fr, name_en, color_hex, map_order, status, published_at, geojson, centroid_lat, centroid_lng",
    )
    .is("deleted_at", null);

  if (!includeDraft) {
    query = query.or("status.eq.published,published_at.not.is.null");
  }

  const { data, error } = await query.order("map_order", {
    ascending: true,
  });

  if (error) throw new Error(`Failed to fetch regions: ${error.message}`);
  return (data ?? []) as WineRegion[];
}

export async function getRegionBySlug(
  slug: string,
): Promise<WineRegion | null> {
  const supabase = await createClient();
  const includeDraft = process.env.NODE_ENV !== "production";

  let query = supabase
    .from("wine_regions")
    .select(
      "id, slug, name_fr, name_en, department_count, area_hectares, total_production_hl, main_grapes_fr, main_grapes_en, color_hex, map_order, status, created_at, updated_at, deleted_at, centroid_lat, centroid_lng, geojson, published_at",
    )
    .eq("slug", slug)
    .is("deleted_at", null);

  if (!includeDraft) {
    query = query.or("status.eq.published,published_at.not.is.null");
  }

  const { data, error } = await query.single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to fetch region: ${error.message}`);
  }
  return data as WineRegion;
}
