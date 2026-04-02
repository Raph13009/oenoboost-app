import { createClient } from "@/lib/supabase/client";

type LinkAppellationRow = {
  subregion_id: string | null;
  appellation:
    | {
        id: string;
        slug: string;
        name_fr: string;
        name_en: string;
        deleted_at: string | null;
      }
    | {
        id: string;
        slug: string;
        name_fr: string;
        name_en: string;
        deleted_at: string | null;
      }[]
    | null;
};

type CommuneLinkRow = {
  appellation_id: string;
  commune:
    | {
        id: string;
        name: string;
        geometry: unknown | null;
        code_insee: string | null;
      }
    | {
        id: string;
        name: string;
        geometry: unknown | null;
        code_insee: string | null;
      }[]
    | null;
};

export type MapAppellationCommune = {
  id: string;
  name: string;
  code_insee: string | null;
  geometry: unknown | null;
};

export type MapAppellationCommunes = {
  id: string;
  subregion_id: string | null;
  slug: string;
  name_fr: string;
  name_en: string;
  communes: MapAppellationCommune[];
};

export async function getAppellationCommunesBySubregionIds(
  subregionIds: string[],
): Promise<MapAppellationCommunes[]> {
  if (subregionIds.length === 0) return [];

  const supabase = createClient();

  let linksQuery = supabase
    .from("appellation_subregion_links")
    .select(
      "subregion_id, appellation:appellation_id(id, slug, name_fr, name_en, deleted_at, status, published_at)",
    )
    .in("subregion_id", subregionIds);

  const { data: linksData, error: linksError } = await linksQuery;
  if (linksError) {
    throw new Error(
      `Failed to fetch appellation-subregion links: ${linksError.message}`,
    );
  }

  const appellations = ((linksData ?? []) as LinkAppellationRow[])
    .map((row) => {
      const raw = row.appellation;
      const appellation = Array.isArray(raw) ? raw[0] ?? null : raw;
      if (!appellation || appellation.deleted_at) return null;
      return {
        id: appellation.id,
        subregion_id: row.subregion_id ?? null,
        slug: appellation.slug,
        name_fr: appellation.name_fr,
        name_en: appellation.name_en,
      };
    })
    .filter(
      (
        row,
      ): row is Omit<MapAppellationCommunes, "communes"> => row !== null,
    );

  const appellationIds = Array.from(new Set(appellations.map((row) => row.id)));
  if (appellationIds.length === 0) return [];

  const { data: communeLinksData, error: communeLinksError } = await supabase
    .from("appellation_commune_links")
    .select("appellation_id, commune:commune_id(id, name, geometry, code_insee)")
    .in("appellation_id", appellationIds);

  if (communeLinksError) {
    throw new Error(
      `Failed to fetch appellation communes: ${communeLinksError.message}`,
    );
  }

  const communesByAppellationId = new Map<string, MapAppellationCommune[]>();
  for (const row of (communeLinksData ?? []) as CommuneLinkRow[]) {
    const raw = row.commune;
    const commune = Array.isArray(raw) ? raw[0] ?? null : raw;
    if (!commune) continue;

    const communes = communesByAppellationId.get(row.appellation_id) ?? [];
    communes.push({
      id: commune.id,
      name: commune.name,
      code_insee: commune.code_insee ?? null,
      geometry: commune.geometry ?? null,
    });
    communesByAppellationId.set(row.appellation_id, communes);
  }

  return appellations.map((row) => ({
    ...row,
    communes: communesByAppellationId.get(row.id) ?? [],
  }));
}
