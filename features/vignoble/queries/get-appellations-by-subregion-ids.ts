import { createClient } from "@/lib/supabase/client";

const shouldDebugAopMap =
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_DEBUG_AOP_MAP === "1";

export type MapAppellation = {
  id: string;
  subregion_id: string | null;
  slug: string;
  name_fr: string;
  name_en: string;
  centroid_lat: number | null;
  centroid_lng: number | null;
  geojson: unknown | null;
};

type LinkAppellationRow = {
  subregion_id: string | null;
  appellation:
    | {
        id: string;
        slug: string;
        name_fr: string;
        name_en: string;
        centroid_lat: number | null;
        centroid_lng: number | null;
        geojson: unknown | null;
        deleted_at: string | null;
        status: string | null;
        published_at: string | null;
      }
    | {
        id: string;
        slug: string;
        name_fr: string;
        name_en: string;
        centroid_lat: number | null;
        centroid_lng: number | null;
        geojson: unknown | null;
        deleted_at: string | null;
        status: string | null;
        published_at: string | null;
      }[]
    | null;
};

type AppellationLinkAppellation = {
    id: string;
    slug: string;
    name_fr: string;
    name_en: string;
    centroid_lat: number | null;
    centroid_lng: number | null;
    geojson: unknown | null;
    deleted_at: string | null;
    status: string | null;
    published_at: string | null;
};

export async function getAppellationsBySubregionIds(
  subregionIds: string[],
): Promise<MapAppellation[]> {
  if (subregionIds.length === 0) return [];

  const supabase = createClient();
  const includeDraft = process.env.NODE_ENV !== "production";

  let linksQuery = supabase
    .from("appellation_subregion_links")
    .select(
      "subregion_id, appellation:appellation_id(id, slug, name_fr, name_en, centroid_lat, centroid_lng, geojson, deleted_at, status, published_at)",
    )
    .in("subregion_id", subregionIds);

  if (!includeDraft) {
    linksQuery = linksQuery.or(
      "status.eq.published,published_at.not.is.null",
      { referencedTable: "appellation" },
    );
  }

  const { data: linksData, error: linksError } = await linksQuery;
  if (linksError) {
    throw new Error(`Failed to fetch appellations for map: ${linksError.message}`);
  }

  if (shouldDebugAopMap) {
    console.info("[aop-map][query] fetched links", {
      requestedSubregionIds: subregionIds,
      count: linksData?.length ?? 0,
      sample: (linksData ?? []).slice(0, 10),
    });
  }

  const rows: MapAppellation[] = ((linksData ?? []) as LinkAppellationRow[])
    .map((row): MapAppellation | null => {
      const raw = row.appellation;
      const a: AppellationLinkAppellation | null = Array.isArray(raw)
        ? raw[0] ?? null
        : raw;
      if (!a) {
        if (shouldDebugAopMap) {
          console.warn("[aop-map][query] skipped row without appellation", row);
        }
        return null;
      }
      if (a.deleted_at) {
        if (shouldDebugAopMap) {
          console.warn("[aop-map][query] skipped deleted appellation", {
            id: a.id,
            slug: a.slug,
            deleted_at: a.deleted_at,
          });
        }
        return null;
      }
      return {
        id: a.id,
        subregion_id: row.subregion_id ?? null,
        slug: a.slug,
        name_fr: a.name_fr,
        name_en: a.name_en,
        centroid_lat: a.centroid_lat ?? null,
        centroid_lng: a.centroid_lng ?? null,
        geojson: a.geojson ?? null,
      } satisfies MapAppellation;
    })
    .filter((r): r is MapAppellation => r !== null);

  if (shouldDebugAopMap) {
    console.info("[aop-map][query] mapped appellations", {
      count: rows.length,
      items: rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        subregion_id: row.subregion_id,
        centroid_lat: row.centroid_lat,
        centroid_lng: row.centroid_lng,
        has_geojson: Boolean(row.geojson),
      })),
    });
  }

  return rows;
}
