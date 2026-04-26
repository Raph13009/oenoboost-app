import { createClient } from "@/lib/supabase/client";

export type AopMapInfo = {
  id: number;
  slug: string;
  name: string;
  area_hectares: number | null;
  colors_grapes_fr: string | null;
  colors_grapes_en: string | null;
  region_slug: string | null;
  subregion_slug: string | null;
};

type SubregionEmbed = {
  slug: string;
  region: { slug: string } | { slug: string }[] | null;
};

type LinkRow = {
  subregion: SubregionEmbed | SubregionEmbed[] | null;
};

/**
 * Fetch the minimal AOP info needed to populate the map's bottom panel when an
 * AOP polygon is clicked: name, surface, grape varieties, and the slugs needed
 * to link to the AOP detail page.
 */
export async function getAopMapInfo(aopId: number): Promise<AopMapInfo | null> {
  const supabase = createClient();

  const { data: aop, error: aopError } = await supabase
    .from("aop")
    .select(
      "id, slug, name, area_hectares, colors_grapes_fr, colors_grapes_en",
    )
    .eq("id", aopId)
    .is("deleted_at", null)
    .maybeSingle();

  if (aopError) {
    throw new Error(`Failed to fetch AOP info: ${aopError.message}`);
  }
  if (!aop) return null;

  const { data: linkData, error: linkError } = await supabase
    .from("aop_subregion_link")
    .select(
      "subregion:subregion_id(slug, region:wine_regions!subregions_region_id_fkey(slug))",
    )
    .eq("aop_id", aopId)
    .limit(1);

  if (linkError) {
    throw new Error(`Failed to fetch AOP link: ${linkError.message}`);
  }

  const link = (linkData?.[0] ?? null) as LinkRow | null;
  const subRaw = link?.subregion ?? null;
  const sub = Array.isArray(subRaw) ? subRaw[0] ?? null : subRaw;
  const regionRaw = sub?.region ?? null;
  const region = Array.isArray(regionRaw) ? regionRaw[0] ?? null : regionRaw;

  return {
    id: aop.id as number,
    slug: aop.slug as string,
    name: aop.name as string,
    area_hectares: (aop.area_hectares ?? null) as number | null,
    colors_grapes_fr: (aop.colors_grapes_fr ?? null) as string | null,
    colors_grapes_en: (aop.colors_grapes_en ?? null) as string | null,
    region_slug: region?.slug ?? null,
    subregion_slug: sub?.slug ?? null,
  };
}
