import { createClient } from "@/lib/supabase/server";
import type { RelatedAop, RelatedSoil, SoilType } from "../types";

const SOIL_COLUMNS =
  "id, slug, name_fr, geological_origin_fr, regions_fr, mineral_composition_fr, wine_influence_fr, photo_url, carousel_order, is_premium, status, published_at, created_at, updated_at";

/** Logs serveur pour diagnostiquer « AOP associées » vides. `DEBUG_SOIL_AOPS=1` en prod/staging si besoin. */
function debugRelatedAops(
  step: string,
  payload?: Record<string, unknown>,
): void {
  const enabled =
    process.env.DEBUG_SOIL_AOPS === "1" || process.env.NODE_ENV === "development";
  if (!enabled) return;
  const line = payload
    ? `[getRelatedAopsForSoil] ${step} ${JSON.stringify(payload)}`
    : `[getRelatedAopsForSoil] ${step}`;
  console.info(line);
}

export async function getPublishedSoils() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("soil_types")
    .select(SOIL_COLUMNS)
    .eq("status", "published")
    .order("carousel_order", { ascending: true, nullsFirst: false });

  if (error) {
    throw new Error(`Failed to fetch soils: ${error.message}`);
  }

  return (data ?? []) as SoilType[];
}

export async function getSoilBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("soil_types")
    .select(SOIL_COLUMNS)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch soil: ${error.message}`);
  }

  return (data ?? null) as SoilType | null;
}

export async function getRelatedSoilsForAppellation(
  appellationId: string,
): Promise<RelatedSoil[]> {
  const supabase = await createClient();
  const { data: links, error: linksError } = await supabase
    .from("appellation_soil_links")
    .select("soil_type_id")
    .eq("appellation_id", appellationId);

  if (linksError) {
    throw new Error(`Failed to fetch appellation soils: ${linksError.message}`);
  }

  const soilIds = Array.from(
    new Set(
      (links ?? [])
        .map((link) => link.soil_type_id as string | null)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  if (soilIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("soil_types")
    .select("id, slug, name_fr, is_premium")
    .in("id", soilIds)
    .eq("status", "published")
    .order("carousel_order", { ascending: true, nullsFirst: false })
    .order("name_fr", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch related soils: ${error.message}`);
  }

  return (data ?? []) as RelatedSoil[];
}

export async function getRelatedAopsForSoil(soilId: string): Promise<RelatedAop[]> {
  debugRelatedAops("start", { soilId });

  const supabase = await createClient();
  const { data: links, error: linksError } = await supabase
    .from("appellation_soil_links")
    .select("appellation_id")
    .eq("soil_type_id", soilId);

  if (linksError) {
    debugRelatedAops("appellation_soil_links ERROR", {
      message: linksError.message,
      code: linksError.code,
    });
    throw new Error(`Failed to fetch soil links: ${linksError.message}`);
  }

  const linkRows = links ?? [];
  debugRelatedAops("appellation_soil_links rows", {
    count: linkRows.length,
    sampleAppellationIds: linkRows.slice(0, 8).map((l) => l.appellation_id),
  });

  const appellationIds = Array.from(
    new Set(
      linkRows
        .map((link) => link.appellation_id as string | null)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  if (appellationIds.length === 0) {
    debugRelatedAops("early_exit", {
      reason: "no_appellation_ids_after_soil_links",
      soilId,
    });
    return [];
  }

  /** Aligné sur `getAppellationBySlug` / `getAppellations` : ne pas exiger published_at si status=published. */
  const includeDraftAppellations = process.env.NODE_ENV !== "production";

  let appellationsQuery = supabase
    .from("appellations")
    .select("id, slug, name_fr, status, published_at, deleted_at")
    .in("id", appellationIds)
    .is("deleted_at", null);

  if (!includeDraftAppellations) {
    appellationsQuery = appellationsQuery.or(
      "status.eq.published,published_at.not.is.null",
    );
  }

  const { data: appellations, error: appellationsError } =
    await appellationsQuery;

  if (appellationsError) {
    debugRelatedAops("appellations ERROR", {
      message: appellationsError.message,
      code: appellationsError.code,
    });
    throw new Error(`Failed to fetch related AOPs: ${appellationsError.message}`);
  }

  const publishedAppellations = (appellations ?? []) as {
    id: string;
    slug: string;
    name_fr: string;
  }[];

  if (publishedAppellations.length === 0) {
    debugRelatedAops("early_exit", {
      reason: "no_appellations_after_filter",
      soilId,
      requestedAppellationIds: appellationIds,
      hint:
        "prod: or(status=published, published_at non null) + deleted_at null ; dev: tout sauf deleted",
    });
    return [];
  }

  debugRelatedAops("appellations OK", {
    count: publishedAppellations.length,
    slugs: publishedAppellations.slice(0, 10).map((a) => a.slug),
  });

  /** Requêtes plates (sans embed PostgREST) — même idée que `getFavoriteAppellationsForUser`. */
  const { data: subLinkRows, error: subLinkErr } = await supabase
    .from("appellation_subregion_links")
    .select("appellation_id, subregion_id")
    .in(
      "appellation_id",
      publishedAppellations.map((a) => a.id),
    )
    .not("subregion_id", "is", null);

  if (subLinkErr) {
    debugRelatedAops("appellation_subregion_links ERROR", {
      message: subLinkErr.message,
      code: subLinkErr.code,
    });
    throw new Error(
      `Failed to fetch related AOP navigation data: ${subLinkErr.message}`,
    );
  }

  const rawSubLinks = subLinkRows ?? [];
  debugRelatedAops("appellation_subregion_links rows", {
    count: rawSubLinks.length,
    sample: rawSubLinks.slice(0, 6),
  });

  const firstSubregionByAppellation = new Map<string, string>();
  for (const row of subLinkRows ?? []) {
    const aid = row.appellation_id as string | null;
    const sid = row.subregion_id as string | null;
    if (!aid || !sid || firstSubregionByAppellation.has(aid)) continue;
    firstSubregionByAppellation.set(aid, sid);
  }

  const subIds = [...new Set(firstSubregionByAppellation.values())];
  const routeByAppellationId = new Map<
    string,
    { region_slug: string; subregion_slug: string }
  >();

  const appellationIdsWithoutSubLink = publishedAppellations
    .map((a) => a.id)
    .filter((id) => !firstSubregionByAppellation.has(id));
  if (appellationIdsWithoutSubLink.length > 0) {
    debugRelatedAops("warning_missing_subregion_link", {
      count: appellationIdsWithoutSubLink.length,
      appellationIds: appellationIdsWithoutSubLink.slice(0, 12),
    });
  }

  debugRelatedAops("subregion_ids_for_geo", {
    uniqueSubregionCount: subIds.length,
    subIds: subIds.slice(0, 8),
  });

  if (subIds.length > 0) {
    const { data: subregions, error: subErr } = await supabase
      .from("wine_subregions")
      .select("id, slug, region_id")
      .in("id", subIds)
      .is("deleted_at", null);

    if (subErr) {
      debugRelatedAops("wine_subregions ERROR", {
        message: subErr.message,
        code: subErr.code,
      });
      throw new Error(
        `Failed to fetch subregions for soil AOP links: ${subErr.message}`,
      );
    }

    debugRelatedAops("wine_subregions rows", {
      count: (subregions ?? []).length,
    });

    const regionIds = [
      ...new Set((subregions ?? []).map((s) => s.region_id)),
    ];

    const { data: regions, error: regErr } = await supabase
      .from("wine_regions")
      .select("id, slug")
      .in("id", regionIds)
      .is("deleted_at", null);

    if (regErr) {
      debugRelatedAops("wine_regions ERROR", {
        message: regErr.message,
        code: regErr.code,
      });
      throw new Error(
        `Failed to fetch regions for soil AOP links: ${regErr.message}`,
      );
    }

    debugRelatedAops("wine_regions rows", {
      count: (regions ?? []).length,
    });

    const regionSlugById = new Map(
      (regions ?? []).map((r) => [r.id, r.slug] as const),
    );
    const subById = new Map(
      (subregions ?? []).map((s) => [
        s.id,
        {
          subSlug: s.slug,
          regionSlug: regionSlugById.get(s.region_id),
        },
      ]),
    );

    for (const a of publishedAppellations) {
      const subId = firstSubregionByAppellation.get(a.id);
      if (!subId) continue;
      const entry = subById.get(subId);
      if (entry?.regionSlug) {
        routeByAppellationId.set(a.id, {
          region_slug: entry.regionSlug,
          subregion_slug: entry.subSlug,
        });
      }
    }
  }

  debugRelatedAops("routes_built", {
    routeCount: routeByAppellationId.size,
    keys: [...routeByAppellationId.keys()].slice(0, 8),
  });

  const result = publishedAppellations
    .map((appellation) => {
      const route = routeByAppellationId.get(appellation.id);
      if (!route) {
        return null;
      }

      return {
        id: appellation.id,
        slug: appellation.slug,
        name_fr: appellation.name_fr,
        name_en: appellation.name_fr,
        region_slug: route.region_slug,
        subregion_slug: route.subregion_slug,
      };
    })
    .filter((value): value is RelatedAop => Boolean(value))
    .sort((a, b) => a.name_fr.localeCompare(b.name_fr, "fr"));

  if (result.length === 0 && publishedAppellations.length > 0) {
    debugRelatedAops("early_exit", {
      reason: "published_appellations_but_no_navigable_route",
      soilId,
      publishedCount: publishedAppellations.length,
      hadSubLinkRows: rawSubLinks.length > 0,
      hadSubregionIds: subIds.length > 0,
      routeMapSize: routeByAppellationId.size,
    });
  }

  debugRelatedAops("done", { resultCount: result.length });

  return result;
}
