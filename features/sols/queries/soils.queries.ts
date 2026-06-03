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
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch soil: ${error.message}`);
  }

  return (data ?? null) as SoilType | null;
}

export async function getRelatedSoilsForAppellation(
  appellationId: number,
): Promise<RelatedSoil[]> {
  const supabase = await createClient();
  const { data: links, error: linksError } = await supabase
    .from("aop_soil_link")
    .select("soil_type_id")
    .eq("aop_id", appellationId);

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
    .from("aop_soil_link")
    .select("aop_id")
    .eq("soil_type_id", soilId);

  if (linksError) {
    debugRelatedAops("aop_soil_link ERROR", {
      message: linksError.message,
      code: linksError.code,
    });
    throw new Error(`Failed to fetch soil links: ${linksError.message}`);
  }

  const linkRows = links ?? [];
  debugRelatedAops("aop_soil_link rows", {
    count: linkRows.length,
    sampleAopIds: linkRows.slice(0, 8).map((l) => l.aop_id),
  });

  const aopIds = Array.from(
    new Set(
      linkRows
        .map((link) => link.aop_id as number | null)
        .filter((value): value is number => typeof value === "number"),
    ),
  );

  if (aopIds.length === 0) {
    debugRelatedAops("early_exit", {
      reason: "no_aop_ids_after_soil_links",
      soilId,
    });
    return [];
  }

  const aopsQuery = supabase
    .from("aop")
    .select("id, slug, name, status, published_at, deleted_at")
    .in("id", aopIds)
    .is("deleted_at", null);

  const { data: aops, error: aopsError } = await aopsQuery;

  if (aopsError) {
    debugRelatedAops("aop ERROR", {
      message: aopsError.message,
      code: aopsError.code,
    });
    throw new Error(`Failed to fetch related AOPs: ${aopsError.message}`);
  }

  const publishedAops = (aops ?? []) as {
    id: number;
    slug: string;
    name: string;
  }[];

  if (publishedAops.length === 0) {
    debugRelatedAops("early_exit", {
      reason: "no_aops_after_filter",
      soilId,
      requestedAopIds: aopIds,
      hint: "filter: deleted_at null only (draft included)",
    });
    return [];
  }

  debugRelatedAops("aops OK", {
    count: publishedAops.length,
    slugs: publishedAops.slice(0, 10).map((a) => a.slug),
  });

  /** Requêtes plates (sans embed PostgREST) — même idée que `getFavoriteAppellationsForUser`. */
  const { data: subLinkRows, error: subLinkErr } = await supabase
    .from("aop_subregion_link")
    .select("aop_id, subregion_id")
    .in(
      "aop_id",
      publishedAops.map((a) => a.id),
    )
    .not("subregion_id", "is", null);

  if (subLinkErr) {
    debugRelatedAops("aop_subregion_link ERROR", {
      message: subLinkErr.message,
      code: subLinkErr.code,
    });
    throw new Error(
      `Failed to fetch related AOP navigation data: ${subLinkErr.message}`,
    );
  }

  const rawSubLinks = subLinkRows ?? [];
  debugRelatedAops("aop_subregion_link rows", {
    count: rawSubLinks.length,
    sample: rawSubLinks.slice(0, 6),
  });

  const firstSubregionByAop = new Map<number, number>();
  for (const row of subLinkRows ?? []) {
    const aid = row.aop_id as number | null;
    const sid = row.subregion_id as number | null;
    if (aid == null || sid == null || firstSubregionByAop.has(aid)) continue;
    firstSubregionByAop.set(aid, sid);
  }

  const subIds = [...new Set(firstSubregionByAop.values())];
  const routeByAopId = new Map<
    number,
    { region_slug: string; subregion_slug: string }
  >();

  const aopIdsWithoutSubLink = publishedAops
    .map((a) => a.id)
    .filter((id) => !firstSubregionByAop.has(id));
  if (aopIdsWithoutSubLink.length > 0) {
    debugRelatedAops("warning_missing_subregion_link", {
      count: aopIdsWithoutSubLink.length,
      aopIds: aopIdsWithoutSubLink.slice(0, 12),
    });
  }

  debugRelatedAops("subregion_ids_for_geo", {
    uniqueSubregionCount: subIds.length,
    subIds: subIds.slice(0, 8),
  });

  if (subIds.length > 0) {
    const { data: subregions, error: subErr } = await supabase
      .from("subregions")
      .select("id, slug, region_id")
      .in("id", subIds)
      .is("deleted_at", null);

    if (subErr) {
      debugRelatedAops("subregions ERROR", {
        message: subErr.message,
        code: subErr.code,
      });
      throw new Error(
        `Failed to fetch subregions for soil AOP links: ${subErr.message}`,
      );
    }

    debugRelatedAops("subregions rows", {
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

    for (const a of publishedAops) {
      const subId = firstSubregionByAop.get(a.id);
      if (!subId) continue;
      const entry = subById.get(subId);
      if (entry?.regionSlug) {
        routeByAopId.set(a.id, {
          region_slug: entry.regionSlug,
          subregion_slug: entry.subSlug,
        });
      }
    }
  }

  debugRelatedAops("routes_built", {
    routeCount: routeByAopId.size,
    keys: [...routeByAopId.keys()].slice(0, 8),
  });

  const result = publishedAops
    .map((aop) => {
      const route = routeByAopId.get(aop.id);
      if (!route) {
        return null;
      }

      return {
        id: aop.id,
        slug: aop.slug,
        name: aop.name,
        region_slug: route.region_slug,
        subregion_slug: route.subregion_slug,
      };
    })
    .filter((value): value is RelatedAop => Boolean(value))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  if (result.length === 0 && publishedAops.length > 0) {
    debugRelatedAops("early_exit", {
      reason: "published_aops_but_no_navigable_route",
      soilId,
      publishedCount: publishedAops.length,
      hadSubLinkRows: rawSubLinks.length > 0,
      hadSubregionIds: subIds.length > 0,
      routeMapSize: routeByAopId.size,
    });
  }

  debugRelatedAops("done", { resultCount: result.length });

  return result;
}
