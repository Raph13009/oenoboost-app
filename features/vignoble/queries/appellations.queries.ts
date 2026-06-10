import { createClient } from "@/lib/supabase/server";
import type { Appellation } from "../types";

const AOP_COLUMNS =
  "id, slug, name, area_hectares, producer_count, production_volume_hl, price_range_min_eur, price_range_max_eur, history_fr, history_en, colors_grapes_fr, colors_grapes_en, soils_description_fr, soils_description_en, climate_fr, climate_en, is_grand_cru, wine_pct_red, wine_pct_rose, wine_pct_white, wine_pct_sparkling, wine_pct_liqueur, is_premium, status, created_at, updated_at, deleted_at, published_at";

export async function getAppellations(
  subregionId: number,
): Promise<Appellation[]> {
  const supabase = await createClient();

  const query = supabase
    .from("aop_subregion_link")
    .select(`aop:aop_id(${AOP_COLUMNS})`)
    .eq("subregion_id", subregionId);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch appellations: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{
    aop: Appellation | Appellation[] | null;
  }>;

  return rows
    .map((row) => {
      const raw = row.aop;
      const a = Array.isArray(raw) ? raw[0] ?? null : raw;
      if (!a || a.deleted_at) return null;
      return a;
    })
    .filter((r): r is Appellation => Boolean(r))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getAppellationBySlug(
  slug: string,
): Promise<Appellation | null> {
  const supabase = await createClient();

  const query = supabase
    .from("aop")
    .select(AOP_COLUMNS)
    .eq("slug", slug)
    .is("deleted_at", null);

  const { data, error } = await query.single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to fetch appellation: ${error.message}`);
  }

  return data as Appellation;
}
