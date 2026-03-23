import { createClient } from "@/lib/supabase/server";
import type { Appellation } from "../types";

export async function isAppellationFavorited(
  userId: string,
  appellationId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", userId)
    .eq("content_type", "appellation")
    .eq("content_id", appellationId)
    .eq("module", "vignoble")
    .maybeSingle();

  if (error) return false;
  return !!data;
}

export type FavoriteAppellationRow = {
  favoriteId: string;
  appellation: Pick<Appellation, "id" | "slug" | "name_fr" | "name_en">;
  regionSlug: string;
  subregionSlug: string;
};

/**
 * Favorites first (created_at desc). One region/subregion path per appellation (first link).
 */
export async function getFavoriteAppellationsForUser(
  userId: string,
): Promise<FavoriteAppellationRow[]> {
  const supabase = await createClient();

  const { data: favs, error: favError } = await supabase
    .from("favorites")
    .select("id, content_id, created_at")
    .eq("user_id", userId)
    .eq("content_type", "appellation")
    .eq("module", "vignoble")
    .order("created_at", { ascending: false });

  if (favError || !favs?.length) return [];

  const ids = favs.map((f) => f.content_id);

  const { data: links, error: linkError } = await supabase
    .from("appellation_subregion_links")
    .select("appellation_id, subregion_id")
    .in("appellation_id", ids)
    .not("subregion_id", "is", null);

  if (linkError || !links?.length) return [];

  const firstPathByAppellation = new Map<
    string,
    { subregionId: string }
  >();

  for (const row of links) {
    const aid = row.appellation_id as string;
    const sid = row.subregion_id as string | null;
    if (!sid || firstPathByAppellation.has(aid)) continue;
    firstPathByAppellation.set(aid, { subregionId: sid });
  }

  const subIds = [
    ...new Set(
      [...firstPathByAppellation.values()].map((p) => p.subregionId),
    ),
  ];

  const { data: subregions, error: subErr } = await supabase
    .from("wine_subregions")
    .select("id, slug, region_id")
    .in("id", subIds)
    .is("deleted_at", null);

  if (subErr || !subregions?.length) return [];

  const regionIds = [...new Set(subregions.map((s) => s.region_id))];

  const { data: regions, error: regErr } = await supabase
    .from("wine_regions")
    .select("id, slug")
    .in("id", regionIds)
    .is("deleted_at", null);

  if (regErr || !regions?.length) return [];

  const regionSlugById = new Map(regions.map((r) => [r.id, r.slug]));
  const subById = new Map(
    subregions.map((s) => [
      s.id,
      {
        slug: s.slug,
        regionSlug: regionSlugById.get(s.region_id),
      },
    ]),
  );

  const { data: appellations, error: aError } = await supabase
    .from("appellations")
    .select("id, slug, name_fr, name_en")
    .in("id", ids)
    .is("deleted_at", null);

  if (aError || !appellations) return [];

  const byId = new Map(appellations.map((a) => [a.id, a]));
  const out: FavoriteAppellationRow[] = [];

  for (const f of favs) {
    const a = byId.get(f.content_id);
    const path = firstPathByAppellation.get(f.content_id);
    if (!a || !path) continue;
    const sub = subById.get(path.subregionId);
    if (!sub?.regionSlug) continue;
    out.push({
      favoriteId: f.id,
      appellation: a,
      regionSlug: sub.regionSlug,
      subregionSlug: sub.slug,
    });
  }

  return out;
}
