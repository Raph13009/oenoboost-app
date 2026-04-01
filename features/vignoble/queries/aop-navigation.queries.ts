import { createClient } from "@/lib/supabase/server";
import { getRegionBySlug } from "./regions.queries";
import { getAppellationBySlug } from "./appellations.queries";
import type { WineSubregion } from "../types";

type LinkAppellationRow = {
  subregion_id: string | null;
  appellation:
    | {
        id: string;
        slug: string;
        name_fr: string;
        name_en: string;
        area_hectares: number | null;
        producer_count: number | null;
        production_volume_hl: number | null;
        price_range_min_eur: number | null;
        price_range_max_eur: number | null;
        history_fr: string | null;
        history_en: string | null;
        colors_grapes_fr: string | null;
        colors_grapes_en: string | null;
        soils_description_fr: string | null;
        soils_description_en: string | null;
        geojson: unknown | null;
        centroid_lat: number | null;
        centroid_lng: number | null;
        is_premium: boolean;
        status: string | null;
        published_at: string | null;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }
    | {
        id: string;
        slug: string;
        name_fr: string;
        name_en: string;
        area_hectares: number | null;
        producer_count: number | null;
        production_volume_hl: number | null;
        price_range_min_eur: number | null;
        price_range_max_eur: number | null;
        history_fr: string | null;
        history_en: string | null;
        colors_grapes_fr: string | null;
        colors_grapes_en: string | null;
        soils_description_fr: string | null;
        soils_description_en: string | null;
        geojson: unknown | null;
        centroid_lat: number | null;
        centroid_lng: number | null;
        is_premium: boolean;
        status: string | null;
        published_at: string | null;
        created_at: string;
        updated_at: string;
        deleted_at: string | null;
      }[]
    | null;
};

type AopRecord = {
  id: string;
  subregion_id: string;
  slug: string;
  name_fr: string;
  name_en: string;
  area_hectares: number | null;
  producer_count: number | null;
  production_volume_hl: number | null;
  price_range_min_eur: number | null;
  price_range_max_eur: number | null;
  history_fr: string | null;
  history_en: string | null;
  colors_grapes_fr: string | null;
  colors_grapes_en: string | null;
  soils_description_fr: string | null;
  soils_description_en: string | null;
  geojson: unknown | null;
  centroid_lat: number | null;
  centroid_lng: number | null;
  is_premium: boolean;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type AopBrowseItem = {
  id: string;
  slug: string;
  name_fr: string;
  name_en: string;
  area_hectares: number | null;
  subregion_slug: string;
  subregion_name_fr: string;
  subregion_name_en: string;
  region_slug: string;
  region_name_fr: string;
  region_name_en: string;
};

type AopBrowseRow = {
  appellation:
    | {
        id: string;
        slug: string;
        name_fr: string;
        name_en: string;
        area_hectares: number | null;
        status: string | null;
        published_at: string | null;
        deleted_at: string | null;
      }
    | {
        id: string;
        slug: string;
        name_fr: string;
        name_en: string;
        area_hectares: number | null;
        status: string | null;
        published_at: string | null;
        deleted_at: string | null;
      }[]
    | null;
  subregion:
    | {
        id: string;
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
        id: string;
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

async function getAppellationsBySubregionIds(subregionIds: string[]) {
  if (subregionIds.length === 0) return [];
  const supabase = await createClient();
  const includeDraft = process.env.NODE_ENV !== "production";

  let linksQuery = supabase
    .from("appellation_subregion_links")
    .select(
      "subregion_id, appellation:appellation_id(id, slug, name_fr, name_en, area_hectares, producer_count, production_volume_hl, price_range_min_eur, price_range_max_eur, history_fr, history_en, colors_grapes_fr, colors_grapes_en, soils_description_fr, soils_description_en, geojson, centroid_lat, centroid_lng, is_premium, status, published_at, created_at, updated_at, deleted_at)",
    )
    .in("subregion_id", subregionIds);

  if (!includeDraft) {
    linksQuery = linksQuery.or(
      "status.eq.published,published_at.not.is.null",
      { referencedTable: "appellation" },
    );
  }

  const { data, error } = await linksQuery;
  if (error) {
    throw new Error(`Failed to fetch appellations: ${error.message}`);
  }
  return (data ?? []) as LinkAppellationRow[];
}

export async function getAopDetailByRegionAndSlug(regionSlug: string, aopSlug: string) {
  const region = await getRegionBySlug(regionSlug);
  if (!region) return null;

  const appellation = await getAppellationBySlug(aopSlug);
  if (!appellation) return null;

  const supabase = await createClient();
  const { data: links, error: linksError } = await supabase
    .from("appellation_subregion_links")
    .select("subregion_id")
    .eq("appellation_id", appellation.id)
    .not("subregion_id", "is", null);

  if (linksError) {
    throw new Error(`Failed to fetch appellation links: ${linksError.message}`);
  }

  const subregionIds = (links ?? [])
    .map((l) => l.subregion_id as string | null)
    .filter((id): id is string => Boolean(id));
  if (subregionIds.length === 0) return null;

  const { data: subregions, error: subregionsError } = await supabase
    .from("wine_subregions")
    .select(
      "id, region_id, slug, name_fr, name_en, area_hectares, description_fr, description_en, map_order, status, created_at, updated_at, deleted_at, centroid_lat, centroid_lng, geojson, published_at",
    )
    .in("id", subregionIds)
    .eq("region_id", region.id)
    .is("deleted_at", null)
    .limit(1);

  if (subregionsError) {
    throw new Error(`Failed to fetch subregion for appellation: ${subregionsError.message}`);
  }

  const subregion = ((subregions ?? [])[0] ?? null) as WineSubregion | null;
  if (!subregion) return null;

  return {
    appellation: {
      ...(appellation as Omit<AopRecord, "subregion_id">),
      subregion_id: subregion.id,
    },
    subregion,
    region,
  };
}

export async function getAopBrowseItems(filters?: {
  regionId?: string;
  subregionId?: string;
}) {
  const supabase = await createClient();
  const includeDraft = process.env.NODE_ENV !== "production";

  let query = supabase
    .from("appellation_subregion_links")
    .select(
      "appellation:appellation_id(id, slug, name_fr, name_en, area_hectares, status, published_at, deleted_at), subregion:subregion_id(id, slug, name_fr, name_en, region_id, status, deleted_at, region:wine_regions!wine_subregions_region_id_fkey(id, slug, name_fr, name_en, status, deleted_at))",
    );

  if (!includeDraft) {
    query = query
      .eq("appellation.status", "published")
      .not("appellation.published_at", "is", null)
      .eq("subregion.status", "published")
      .eq("subregion.region.status", "published");
  }

  query = query
    .is("appellation.deleted_at", null)
    .is("subregion.deleted_at", null)
    .is("subregion.region.deleted_at", null);

  if (filters?.regionId) {
    query = query.eq("subregion.region_id", filters.regionId);
  }
  if (filters?.subregionId) {
    query = query.eq("subregion.id", filters.subregionId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to fetch AOP browse data: ${error.message}`);
  }

  const rows = (data ?? []) as AopBrowseRow[];
  const itemsMap = new Map<string, AopBrowseItem>();
  const regionsMap = new Map<
    string,
    {
      id: string;
      slug: string;
      name_fr: string;
      name_en: string;
      status: string;
      published_at: string | null;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
      department_count: number | null;
      area_hectares: number | null;
      total_production_hl: number | null;
      main_grapes_fr: string | null;
      main_grapes_en: string | null;
      geojson: unknown | null;
      centroid_lat: number | null;
      centroid_lng: number | null;
      color_hex: string | null;
      map_order: number | null;
    }
  >();
  const subregionsMap = new Map<
    string,
    {
      id: string;
      region_id: string;
      slug: string;
      name_fr: string;
      name_en: string;
      area_hectares: number | null;
      description_fr: string | null;
      description_en: string | null;
      geojson: unknown | null;
      centroid_lat: number | null;
      centroid_lng: number | null;
      map_order: number | null;
      status: string;
      published_at: string | null;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
    }
  >();

  for (const row of rows) {
    const aRaw = row.appellation;
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
      name_fr: a.name_fr,
      name_en: a.name_en,
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
        status: region.status ?? "published",
        published_at: null,
        created_at: "",
        updated_at: "",
        deleted_at: null,
        department_count: null,
        area_hectares: null,
        total_production_hl: null,
        main_grapes_fr: null,
        main_grapes_en: null,
        geojson: null,
        centroid_lat: null,
        centroid_lng: null,
        color_hex: null,
        map_order: null,
      });
    }

    if (!subregionsMap.has(sub.id)) {
      subregionsMap.set(sub.id, {
        id: sub.id,
        region_id: sub.region_id,
        slug: sub.slug,
        name_fr: sub.name_fr,
        name_en: sub.name_en,
        area_hectares: null,
        description_fr: null,
        description_en: null,
        geojson: null,
        centroid_lat: null,
        centroid_lng: null,
        map_order: null,
        status: sub.status ?? "published",
        published_at: null,
        created_at: "",
        updated_at: "",
        deleted_at: null,
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
      a.name_fr.localeCompare(b.name_fr),
    ),
  };
}
