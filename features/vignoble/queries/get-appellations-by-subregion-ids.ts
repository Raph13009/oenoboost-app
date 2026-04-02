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

type AppellationSubregionLinkRow = {
  subregion_id: string | null;
  appellation_id: string | null;
};

type AppellationRow = {
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

function chunkArray<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

export async function getAppellationsBySubregionIds(
  subregionIds: string[],
  options?: { includeGeojson?: boolean },
): Promise<MapAppellation[]> {
  if (subregionIds.length === 0) return [];

  const supabase = createClient();
  const includeDraft = process.env.NODE_ENV !== "production";
  const includeGeojson = options?.includeGeojson === true;

  const subregionChunks = chunkArray(subregionIds, 8);
  const linkRows: AppellationSubregionLinkRow[] = [];

  for (const chunk of subregionChunks) {
    const { data, error } = await supabase
      .from("appellation_subregion_links")
      .select("subregion_id, appellation_id")
      .in("subregion_id", chunk);

    if (error) {
      throw new Error(`Failed to fetch appellations for map: ${error.message}`);
    }

    linkRows.push(...((data ?? []) as AppellationSubregionLinkRow[]));
  }

  const appellationIds = Array.from(
    new Set(
      linkRows
        .map((row) => row.appellation_id)
        .filter((value): value is string => typeof value === "string"),
    ),
  );

  if (shouldDebugAopMap) {
    console.info("[aop-map][query] fetched link rows", {
      requestedSubregionIds: subregionIds,
      linkCount: linkRows.length,
      appellationCount: appellationIds.length,
      sample: linkRows.slice(0, 10),
    });
  }

  if (appellationIds.length === 0) return [];

  const appellationChunks = chunkArray(appellationIds, 24);
  const appellationById = new Map<string, AppellationRow>();
  const selectClause = includeGeojson
    ? "id, slug, name_fr, name_en, centroid_lat, centroid_lng, geojson, deleted_at, status, published_at"
    : "id, slug, name_fr, name_en, centroid_lat, centroid_lng, deleted_at, status, published_at";

  for (const chunk of appellationChunks) {
    let query = supabase
      .from("appellations")
      .select(selectClause)
      .in("id", chunk)
      .is("deleted_at", null);

    if (!includeDraft) {
      query = query.or("status.eq.published,published_at.not.is.null");
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to fetch appellations for map: ${error.message}`);
    }

    for (const row of ((data ?? []) as unknown as AppellationRow[])) {
      appellationById.set(row.id, row);
    }
  }

  const rows: MapAppellation[] = linkRows
    .map((link) => {
      if (!link.appellation_id) return null;
      const appellation = appellationById.get(link.appellation_id);
      if (!appellation) return null;

      return {
        id: appellation.id,
        subregion_id: link.subregion_id ?? null,
        slug: appellation.slug,
        name_fr: appellation.name_fr,
        name_en: appellation.name_en,
        centroid_lat: appellation.centroid_lat ?? null,
        centroid_lng: appellation.centroid_lng ?? null,
        geojson: includeGeojson ? (appellation.geojson ?? null) : null,
      } satisfies MapAppellation;
    })
    .filter((row): row is MapAppellation => row !== null);

  if (shouldDebugAopMap) {
    console.info("[aop-map][query] mapped appellations", {
      count: rows.length,
      items: rows.slice(0, 25).map((row) => ({
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
