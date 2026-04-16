import { createClient } from "@/lib/supabase/client";

/** Dropdown option for AOP filters. `id` is the stringified integer subregion id
 * so URL search params, HTML <option value>, and this list all share the same
 * primitive. Coerce back to number at the server query boundary. */
export type SubregionOption = {
  id: string;
  region_id: string;
  name_fr: string;
  name_en: string;
};

export async function getSubregionOptionsByRegionId(regionId: string) {
  const supabase = createClient();
  const includeDraft = process.env.NODE_ENV !== "production";

  let query = supabase
    .from("subregions")
    .select("id, region_id, name_fr, name_en")
    .eq("region_id", regionId)
    .is("deleted_at", null)
    .order("name_fr", { ascending: true });

  if (!includeDraft) {
    query = query.eq("status", "published").not("published_at", "is", null);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(
      `Failed to fetch subregion options for region ${regionId}: ${error.message}`,
    );
  }
  const rows = (data ?? []) as Array<{
    id: number;
    region_id: string;
    name_fr: string;
    name_en: string;
  }>;
  return rows.map((r) => ({
    id: String(r.id),
    region_id: r.region_id,
    name_fr: r.name_fr,
    name_en: r.name_en,
  })) satisfies SubregionOption[];
}
