import { createClient } from "@/lib/supabase/server";
import type { Appellation } from "../types";

export async function getAppellations(
  subregionId: string,
): Promise<Appellation[]> {
  const supabase = await createClient();
  const includeDraft = process.env.NODE_ENV !== "production";

  let query = supabase
    .from("appellation_subregion_links")
    .select(
      "subregion_id, appellation:appellation_id(id, slug, name_fr, name_en, area_hectares, producer_count, production_volume_hl, is_premium, status, created_at, updated_at, deleted_at, published_at, price_range_min_eur, price_range_max_eur, history_fr, history_en, colors_grapes_fr, colors_grapes_en, soils_description_fr, soils_description_en, centroid_lat, centroid_lng, geojson)",
    )
    .eq("subregion_id", subregionId);

  if (!includeDraft) {
    query = query.or(
      "appellation.status.eq.published,appellation.published_at.not.is.null",
    );
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch appellations: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{
    subregion_id: string | null;
    appellation:
      | (Omit<Appellation, "subregion_id"> & { deleted_at: string | null })
      | (Omit<Appellation, "subregion_id"> & { deleted_at: string | null })[]
      | null;
  }>;

  const mapped = rows
    .map((row) => {
      const raw = row.appellation;
      const a = Array.isArray(raw) ? raw[0] ?? null : raw;
      if (!a || a.deleted_at) return null;
      return {
        ...a,
        subregion_id: row.subregion_id ?? "",
      } as Appellation;
    })
    .filter((r): r is Appellation => Boolean(r))
    .sort((a, b) => a.name_fr.localeCompare(b.name_fr));

  return mapped;
}

export async function getAppellationBySlug(
  slug: string,
): Promise<Appellation | null> {
  const supabase = await createClient();
  const includeDraft = process.env.NODE_ENV !== "production";

  let query = supabase
    .from("appellations")
    .select(
      "id, slug, name_fr, name_en, area_hectares, producer_count, production_volume_hl, price_range_min_eur, price_range_max_eur, history_fr, history_en, colors_grapes_fr, colors_grapes_en, soils_description_fr, soils_description_en, is_premium, status, created_at, updated_at, deleted_at, published_at, centroid_lat, centroid_lng, geojson",
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

  const a = data as Omit<Appellation, "subregion_id">;
  return {
    ...a,
    // canonical relation is in appellation_subregion_links
    subregion_id: "",
  } as Appellation;
}
