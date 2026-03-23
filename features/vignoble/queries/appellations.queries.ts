import { createClient } from "@/lib/supabase/server";
import type { Appellation } from "../types";

export async function getAppellations(
  subregionId: string,
): Promise<Appellation[]> {
  const supabase = await createClient();
  const includeDraft = process.env.NODE_ENV !== "production";

  let query = supabase
    .from("appellations")
    .select(
      "id, subregion_id, slug, name_fr, name_en, area_hectares, producer_count, production_volume_hl, is_premium, status, created_at, updated_at, deleted_at, published_at, price_range_min_eur, price_range_max_eur, history_fr, history_en, colors_grapes_fr, colors_grapes_en, soils_description_fr, soils_description_en, centroid_lat, centroid_lng, geojson",
    )
    .eq("subregion_id", subregionId)
    .is("deleted_at", null);

  if (!includeDraft) {
    query = query.or("status.eq.published,published_at.not.is.null");
  }

  const { data, error } = await query.order("name_fr", {
    ascending: true,
  });

  if (error)
    throw new Error(`Failed to fetch appellations: ${error.message}`);
  return (data ?? []) as Appellation[];
}

export async function getAppellationBySlug(
  slug: string,
): Promise<Appellation | null> {
  const supabase = await createClient();
  const includeDraft = process.env.NODE_ENV !== "production";

  let query = supabase
    .from("appellations")
    .select(
      "id, subregion_id, slug, name_fr, name_en, area_hectares, producer_count, production_volume_hl, price_range_min_eur, price_range_max_eur, history_fr, history_en, colors_grapes_fr, colors_grapes_en, soils_description_fr, soils_description_en, is_premium, status, created_at, updated_at, deleted_at, published_at, centroid_lat, centroid_lng, geojson",
    )
    .eq("slug", slug)
    .is("deleted_at", null);

  if (!includeDraft) {
    query = query.or("status.eq.published,published_at.not.is.null");
  }

  const { data, error } = await query.single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to fetch appellation: ${error.message}`);
  }
  return data as Appellation;
}
