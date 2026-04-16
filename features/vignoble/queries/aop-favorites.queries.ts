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
    .eq("content_type", "aop")
    .eq("content_id", appellationId)
    .eq("module", "vignoble")
    .maybeSingle();

  if (error) return false;
  return !!data;
}

export type FavoriteAppellationRow = {
  favoriteId: string;
  appellation: Pick<Appellation, "id" | "slug" | "name">;
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
    .eq("content_type", "aop")
    .eq("module", "vignoble")
    .order("created_at", { ascending: false });

  if (favError || !favs?.length) return [];

  // favorites.content_id is now text (holds integer aop ids as strings)
  const ids = favs
    .map((f) => Number(f.content_id))
    .filter((n) => Number.isFinite(n));
  if (ids.length === 0) return [];

  const { data: links, error: linkError } = await supabase
    .from("aop_subregion_link")
    .select("aop_id, subregion_id")
    .in("aop_id", ids)
    .not("subregion_id", "is", null);

  if (linkError || !links?.length) return [];

  const firstPathByAop = new Map<number, { subregionId: number }>();

  for (const row of links) {
    const aid = row.aop_id as number;
    const sid = row.subregion_id as number | null;
    if (sid == null || firstPathByAop.has(aid)) continue;
    firstPathByAop.set(aid, { subregionId: sid });
  }

  const subIds = [
    ...new Set([...firstPathByAop.values()].map((p) => p.subregionId)),
  ];

  const { data: subregions, error: subErr } = await supabase
    .from("subregions")
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

  const { data: aops, error: aError } = await supabase
    .from("aop")
    .select("id, slug, name")
    .in("id", ids)
    .is("deleted_at", null);

  if (aError || !aops) return [];

  const byId = new Map(aops.map((a) => [a.id, a]));
  const out: FavoriteAppellationRow[] = [];

  for (const f of favs) {
    const aopId = Number(f.content_id);
    if (!Number.isFinite(aopId)) continue;
    const a = byId.get(aopId);
    const path = firstPathByAop.get(aopId);
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
