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

export async function getAopDetailByRegionAndSlug(
  regionSlug: string,
  aopSlug: string,
): Promise<{
  appellation: Appellation;
  subregion: Subregion | null;
  region: WineRegion;
} | null> {
  const region = await getRegionBySlug(regionSlug);
  if (!region) return null;

  const appellation = await getAppellationBySlug(aopSlug);
  if (!appellation) return null;

  // Resolve the AOP's owning subregion. The relation is best effort: it
  // powers back navigation and favourite revalidation, but it is not a hard
  // requirement for rendering the page. The map source (the commune to AOP
  // join) can surface AOPs that have no row in `aop_subregion_link`, or
  // whose linked subregion is soft deleted. Those clicks must still land on
  // the detail page instead of 404, since the appellation slug is globally
  // unique and identifies a single AOP on its own.
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

  let subregion: Subregion | null = null;
  if (subregionIds.length > 0) {
    const { data: subregions, error: subregionsError } = await supabase
      .from("subregions")
      .select(
        "id, region_id, slug, name_fr, name_en, description_fr, description_en, area_hectares, centroid_lat, centroid_lng, color_hex, map_order, status, published_at, created_at, updated_at, deleted_at",
      )
      .in("id", subregionIds)
      .is("deleted_at", null);

    if (subregionsError) {
      throw new Error(
        `Failed to fetch subregion for appellation: ${subregionsError.message}`,
      );
    }

    const rows = (subregions ?? []) as Subregion[];
    // Prefer a subregion that belongs to the URL region, but fall back to the
    // first non deleted match if none does. The appellation already pins the
    // detail content; the subregion is only used for navigation context.
    subregion =
      rows.find((row) => row.region_id === region.id) ?? rows[0] ?? null;
  }

  return { appellation, subregion, region };
}

type AopRow = {
  id: number;
  slug: string;
  name: string;
  area_hectares: number | null;
  status: string | null;
  published_at: string | null;
  deleted_at: string | null;
};

type SubregionRegionEmbed = {
  id: string;
  slug: string;
  name_fr: string;
  name_en: string;
  status: string | null;
  deleted_at: string | null;
};

type SubregionEmbed = {
  id: number;
  slug: string;
  name_fr: string;
  name_en: string;
  region_id: string;
  status: string | null;
  deleted_at: string | null;
  region: SubregionRegionEmbed | SubregionRegionEmbed[] | null;
};

type LinkRow = {
  aop_id: number;
  subregion_id: number | null;
  subregion: SubregionEmbed | SubregionEmbed[] | null;
};

type AopLinkInfo = {
  subregion_id: number;
  subregion_slug: string;
  subregion_name_fr: string;
  subregion_name_en: string;
  region_id: string;
  region_slug: string;
  region_name_fr: string;
  region_name_en: string;
};

/**
 * List of AOPs for the `/vignoble/aop` browse page.
 *
 * Source of truth: the `aop` table. Every row in `aop` is exposed here
 * (subject to draft/soft-delete rules). Subregion + region info is joined
 * via `aop_subregion_link`. AOPs without any link still appear in the
 * unfiltered catalog so the full list stays visible after content updates.
 *
 * An AOP can be linked to several subregions (and several regions). We
 * collect every valid link and consider the AOP a match when any of its
 * links satisfies the active region/subregion filter. This is what keeps
 * cross region appellations such as Côtes du Rhône Villages visible on
 * every region they belong to.
 */
export async function getAopBrowseItems(filters?: {
  regionId?: string;
  subregionId?: string;
}) {
  const supabase = await createClient();

  // 1) Pull the AOPs straight from the `aop` table.
  const aopQuery = supabase
    .from("aop")
    .select("id, slug, name, area_hectares, status, published_at, deleted_at")
    .is("deleted_at", null);
  const { data: aopData, error: aopError } = await aopQuery
    .order("name", { ascending: true })
    .limit(2000);
  if (aopError) {
    throw new Error(`Failed to fetch AOPs: ${aopError.message}`);
  }
  const aops = (aopData ?? []) as AopRow[];

  // 2) Pull the subregion links for those AOPs (with subregion + region).
  //    An AOP can span several subregions (and several regions). We collect
  //    every valid link so that region/subregion filtering matches any of
  //    them, not just the first one returned by PostgREST.
  const aopIds = aops.map((a) => a.id);
  const linksByAopId = new Map<number, AopLinkInfo[]>();
  if (aopIds.length > 0) {
    const { data: linkData, error: linkError } = await supabase
      .from("aop_subregion_link")
      .select(
        "aop_id, subregion_id, subregion:subregion_id(id, slug, name_fr, name_en, region_id, status, deleted_at, region:wine_regions!subregions_region_id_fkey(id, slug, name_fr, name_en, status, deleted_at))",
      )
      .in("aop_id", aopIds);
    if (linkError) {
      throw new Error(`Failed to fetch AOP links: ${linkError.message}`);
    }

    for (const row of (linkData ?? []) as LinkRow[]) {
      const subRaw = row.subregion;
      const sub = Array.isArray(subRaw) ? subRaw[0] ?? null : subRaw;
      if (!sub || sub.deleted_at) continue;
      const regionRaw = sub.region;
      const region = Array.isArray(regionRaw) ? regionRaw[0] ?? null : regionRaw;
      if (!region || region.deleted_at) continue;
      const entry: AopLinkInfo = {
        subregion_id: sub.id,
        subregion_slug: sub.slug,
        subregion_name_fr: sub.name_fr,
        subregion_name_en: sub.name_en,
        region_id: region.id,
        region_slug: region.slug,
        region_name_fr: region.name_fr,
        region_name_en: region.name_en,
      };
      const existing = linksByAopId.get(row.aop_id);
      if (existing) {
        if (!existing.some((l) => l.subregion_id === entry.subregion_id)) {
          existing.push(entry);
        }
      } else {
        linksByAopId.set(row.aop_id, [entry]);
      }
    }
  }

  // Pick the link used for display. When a region/subregion filter is active,
  // prefer a link that matches it so the browse card and its href reflect the
  // filtered context. Otherwise fall back to the first link.
  const pickDisplayLink = (
    links: AopLinkInfo[] | undefined,
  ): AopLinkInfo | null => {
    if (!links || links.length === 0) return null;
    if (filters?.subregionId) {
      const subId = Number(filters.subregionId);
      if (Number.isFinite(subId)) {
        const match = links.find((l) => l.subregion_id === subId);
        if (match) return match;
      }
    }
    if (filters?.regionId) {
      const match = links.find((l) => l.region_id === filters.regionId);
      if (match) return match;
    }
    return links[0];
  };

  // 3) Apply optional region/subregion filters from the URL. An AOP matches
  //    when any of its links satisfies every active filter.
  const filteredAops = aops.filter((a) => {
    if (!filters?.regionId && !filters?.subregionId) return true;
    const links = linksByAopId.get(a.id);
    if (!links || links.length === 0) return false;
    const subId = filters.subregionId ? Number(filters.subregionId) : null;
    return links.some((link) => {
      if (filters.regionId && link.region_id !== filters.regionId) return false;
      if (subId !== null) {
        if (!Number.isFinite(subId) || link.subregion_id !== subId) return false;
      }
      return true;
    });
  });

  // 4) Build the final shape consumed by the browse page.
  const items: AopBrowseItem[] = filteredAops.map((a) => {
    const link = pickDisplayLink(linksByAopId.get(a.id));
    return {
      id: a.id,
      slug: a.slug,
      name: a.name,
      area_hectares: a.area_hectares ?? null,
      subregion_slug: link?.subregion_slug ?? "",
      subregion_name_fr: link?.subregion_name_fr ?? "",
      subregion_name_en: link?.subregion_name_en ?? "",
      region_slug: link?.region_slug ?? "",
      region_name_fr: link?.region_name_fr ?? "",
      region_name_en: link?.region_name_en ?? "",
    };
  });

  // 5) Build region/subregion option lists for the filter UI from every link
  //    (not just the displayed one), so the dropdown reflects the full set of
  //    regions/subregions reachable via the catalog.
  const regionsMap = new Map<
    string,
    { id: string; slug: string; name_fr: string; name_en: string }
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
  for (const links of linksByAopId.values()) {
    for (const link of links) {
      if (!regionsMap.has(link.region_id)) {
        regionsMap.set(link.region_id, {
          id: link.region_id,
          slug: link.region_slug,
          name_fr: link.region_name_fr,
          name_en: link.region_name_en,
        });
      }
      if (!subregionsMap.has(link.subregion_id)) {
        subregionsMap.set(link.subregion_id, {
          id: String(link.subregion_id),
          region_id: link.region_id,
          slug: link.subregion_slug,
          name_fr: link.subregion_name_fr,
          name_en: link.subregion_name_en,
        });
      }
    }
  }

  return {
    regions: Array.from(regionsMap.values()).sort((a, b) =>
      a.name_fr.localeCompare(b.name_fr),
    ),
    subregions: Array.from(subregionsMap.values()).sort((a, b) =>
      a.name_fr.localeCompare(b.name_fr),
    ),
    items: items.sort((a, b) => a.name.localeCompare(b.name)),
  };
}
