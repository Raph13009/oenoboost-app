import { createClient } from "@/lib/supabase/client";
import type { WineSubregion } from "../types";

export type VignobleMapSubregion = Pick<
  WineSubregion,
  | "id"
  | "region_id"
  | "slug"
  | "name_fr"
  | "name_en"
  | "geojson"
  | "centroid_lat"
  | "centroid_lng"
  | "area_hectares"
  | "description_fr"
  | "description_en"
>;

export async function getSubregionsByRegionId(
  regionId: string,
): Promise<VignobleMapSubregion[]> {
  const supabase = createClient();
  const includeDraft = process.env.NODE_ENV !== "production";

  let query = supabase
    .from("wine_subregions")
    .select(
      "id, region_id, slug, name_fr, name_en, geojson, centroid_lat, centroid_lng, area_hectares, description_fr, description_en",
    )
    .eq("region_id", regionId)
    .is("deleted_at", null);

  if (!includeDraft) {
    query = query.or("status.eq.published,published_at.not.is.null");
  }

  const { data, error } = await query.order("map_order", {
    ascending: true,
  });

  if (error) {
    throw new Error(
      `Failed to fetch subregions for region ${regionId}: ${error.message}`,
    );
  }

  return (data ?? []) as VignobleMapSubregion[];
}

