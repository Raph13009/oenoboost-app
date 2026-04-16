import { createClient } from "@/lib/supabase/server";
import { getRegionBySlug } from "./regions.queries";
import { getAppellationBySlug } from "./appellations.queries";
import type { Appellation, Subregion, WineRegion } from "../types";

export type AopBrowseItem = {
  id: number;
  slug: string;
  name: string;
  area_hectares: number | null;
  subregion_slug: string;
  subregion_name_fr: string;
  subregion_name_en: string;
  region_slug: string;
  region_name_fr: string;
  region_name_en: string;
};

type AopBrowseRow = {
  aop:
    | {
        id: number;
        slug: string;
        name: string;
        area_hectares: number | null;
        status: string | null;
        published_at: string | null;
        deleted_at: string | null;
      }
    | {
        id: number;
        slug: string;
        name: string;
        area_hectares: number | null;
        status: string | null;
        published_at: string | null;
        deleted_at: string | null;
      }[]
    | null;
  subregion:
    | {
        id: number;
        slug: string;
        name_fr: string;
        name_en: string;
        region_id: string;
        status: string | null;
        deleted_at: string | null;
        region:
          | {
              id: string;
              slug: string;
              name_fr: string;
              name_en: string;
              status: string | null;
              deleted_at: string | null;
            }
          | {
              id: string;
              slug: string;
              name_fr: string;
              name_en: string;
              status: string | null;
              deleted_at: string | null;
            }[]
          | null;
      }
    | {
        id: number;
        slug: string;
        name_fr: string;
        name_en: string;
        region_id: string;
        status: string | null;
        deleted_at: string | null;
        region:
          | {
              id: string;
              slug: string;
              name_fr: string;
              name_en: string;
              status: string | null;
              deleted_at: string | null;
            }
          | {
              id: string;
              slug: string;
              name_fr: string;
              name_en: string;
              status: string | null;
              deleted_at: string | null;
            }[]
          | null;
      }[]
    | null;
};

export async function getAopDetailByRegionAndSlug(
  regionSlug: string,
  aopSlug: string,
): Promise<{
  appellation: Appellation;
  subregion: Subregion;
  region: WineRegion;
} | null> {
  const region = await getRegionBySlug(regionSlug);
  if (!region) return null;

  const appellation = await getAppellationBySlug(aopSlug);
  if (!appellation) return null;

  const supabase = await createClient();
  const { data: links, error: linksError } = await supabase
    .from("aop_subregion_link")
    .select("subregion_id")
    .eq("aop_id", appellation.id)
    .not("subregion_id", "is", null);

  if (linksError) {
    throw new Error(`Failed to fetch appellation links: ${linksError.message}`);
  }

  const subregionIds = (links ?? [])
    .map((l) => l.subregion_id as number | null)
    .filter((id): id is number => typeof id === "number");
  if (subregionIds.length === 0) return null;

  const { data: subregions, error: subregionsError } = await supabase
    .from("subregions")
    .select(
      "id, region_id, slug, name_fr, name_en, description_fr, description_en, area_hectares, centroid_lat, centroid_lng, color_hex, map_order, status, published_at, created_at, updated_at, deleted_at",
    )
    .in("id", subregionIds)
    .eq("region_id", region.id)
    .is("deleted_at", null)
    .limit(1);

  if (subregionsError) {
    throw new Error(
      `Failed to fetch subregion for appellation: ${subregionsError.message}`,
    );
  }

  const subregion = ((subregions ?? [])[0] ?? null) as Subregion | null;
  if (!subregion) return null;

  return { appellation, subregion, region };
}

export async function getAopBrowseItems(filters?: {
  regionId?: string;
  subregionId?: string;
}) {
  const supabase = await createClient();
  const includeDraft = process.env.NODE_ENV !== "production";

  let query = supabase
    .from("aop_subregion_link")
    .select(
      "aop:aop_id(id, slug, name, area_hectares, status, published_at, deleted_at), subregion:subregion_id(id, slug, name_fr, name_en, region_id, status, deleted_at, region:wine_regions!subregions_region_id_fkey(id, slug, name_fr, name_en, status, deleted_at))",
    );

  if (!includeDraft) {
    query = query
      .eq("aop.status", "published")
      .not("aop.published_at", "is", null)
      .eq("subregion.status", "published")
      .eq("subregion.region.status", "published");
  }

  query = query
    .is("aop.deleted_at", null)
    .is("subregion.deleted_at", null)
    .is("subregion.region.deleted_at", null);

  if (filters?.regionId) {
    query = query.eq("subregion.region_id", filters.regionId);
  }
  if (filters?.subregionId) {
    const subId = Number(filters.subregionId);
    if (Number.isFinite(subId)) {
      query = query.eq("subregion.id", subId);
    }
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch AOP browse data: ${error.message}`);
  }

  const rows = (data ?? []) as AopBrowseRow[];
  const itemsMap = new Map<number, AopBrowseItem>();
  const regionsMap = new Map<
    string,
    {
      id: string;
      slug: string;
      name_fr: string;
      name_en: string;
    }
  >();
  const subregionsMap = new Map<
    number,
    {
      id: string;
      region_id: string;
      slug: string;
      name_fr: string;
      name_en: string;
    }
  >();

  for (const row of rows) {
    const aRaw = row.aop;
    const a = Array.isArray(aRaw) ? aRaw[0] ?? null : aRaw;
    const subRaw = row.subregion;
    const sub = Array.isArray(subRaw) ? subRaw[0] ?? null : subRaw;
    const regionRaw = sub?.region ?? null;
    const region = Array.isArray(regionRaw) ? regionRaw[0] ?? null : regionRaw;
    if (!a || !sub || !region) continue;
    if (itemsMap.has(a.id)) continue;

    itemsMap.set(a.id, {
      id: a.id,
      slug: a.slug,
      name: a.name,
      area_hectares: a.area_hectares ?? null,
      subregion_slug: sub.slug,
      subregion_name_fr: sub.name_fr,
      subregion_name_en: sub.name_en,
      region_slug: region.slug,
      region_name_fr: region.name_fr,
      region_name_en: region.name_en,
    });

    if (!regionsMap.has(region.id)) {
      regionsMap.set(region.id, {
        id: region.id,
        slug: region.slug,
        name_fr: region.name_fr,
        name_en: region.name_en,
      });
    }

    if (!subregionsMap.has(sub.id)) {
      subregionsMap.set(sub.id, {
        id: String(sub.id),
        region_id: sub.region_id,
        slug: sub.slug,
        name_fr: sub.name_fr,
        name_en: sub.name_en,
      });
    }
  }

  return {
    regions: Array.from(regionsMap.values()).sort((a, b) =>
      a.name_fr.localeCompare(b.name_fr),
    ),
    subregions: Array.from(subregionsMap.values()).sort((a, b) =>
      a.name_fr.localeCompare(b.name_fr),
    ),
    items: Array.from(itemsMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  };
}
