import { createClient } from "@/lib/supabase/client";

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
    .from("wine_subregions")
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
  return (data ?? []) as SubregionOption[];
}
