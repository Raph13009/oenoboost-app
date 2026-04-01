import { createClient } from "@/lib/supabase/client";

export type MapAppellation = {
  id: string;
  subregion_id: string | null;
  slug: string;
  name_fr: string;
  name_en: string;
  centroid_lat: number | null;
  centroid_lng: number | null;
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
      "subregion_id, appellation:appellation_id(id, slug, name_fr, name_en, centroid_lat, centroid_lng, deleted_at, status, published_at)",
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

  const rows = ((linksData ?? []) as LinkAppellationRow[])
    .map((row) => {
      const raw = row.appellation;
      const a: AppellationLinkAppellation | null = Array.isArray(raw)
        ? raw[0] ?? null
        : raw;
      if (!a) return null;
      if (a.deleted_at) return null;
      return {
        id: a.id,
        subregion_id: row.subregion_id ?? null,
        slug: a.slug,
        name_fr: a.name_fr,
        name_en: a.name_en,
        centroid_lat: a.centroid_lat ?? null,
        centroid_lng: a.centroid_lng ?? null,
      } satisfies MapAppellation;
    })
    .filter((r): r is MapAppellation => Boolean(r));

  return rows;
}
