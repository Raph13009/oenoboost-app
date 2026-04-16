import { createClient } from "@/lib/supabase/client";

/**
 * Subregion shape used by the map layer — content fields plus live-unioned
 * commune geometry from the `get_subregions_geojson_by_region` RPC. Keys
 * mirror the RPC output, not the public.subregions table columns.
 */
export type VignobleMapSubregion = {
  id: number;
  region_id: string;
  slug: string;
  name_fr: string;
  name_en: string;
  description_fr: string | null;
  description_en: string | null;
  area_hectares: number | null;
  centroid_lat: number | null;
  centroid_lng: number | null;
  color_hex: string | null;
  map_order: number | null;
  status: string | null;
  published_at: string | null;
  geometry: unknown | null;
};

export async function getSubregionsByRegionId(
  regionId: string,
): Promise<VignobleMapSubregion[]> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("get_subregions_geojson_by_region", {
    region_id_in: regionId,
  });

  if (error) {
    throw new Error(
      `Failed to fetch subregions for region ${regionId}: ${error.message}`,
    );
  }

  const includeDraft = process.env.NODE_ENV !== "production";
  const rows = (data ?? []) as VignobleMapSubregion[];
  return includeDraft
    ? rows
    : rows.filter(
        (r) => r.status === "published" || r.published_at != null,
      );
}
