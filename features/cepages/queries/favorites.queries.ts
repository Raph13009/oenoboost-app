import { createClient } from "@/lib/supabase/server";
import type { Grape } from "../types";

export async function isGrapeFavorited(
  userId: string,
  grapeId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", userId)
    .eq("content_type", "grape")
    .eq("content_id", grapeId)
    .eq("module", "cepages")
    .maybeSingle();

  if (error) return false;
  return !!data;
}

export type FavoriteGrapeRow = {
  favoriteId: string;
  grape: Pick<Grape, "id" | "slug" | "name_fr" | "name_en" | "type">;
};

/**
 * Favorites first (by created_at desc), then grape rows (published only in prod via caller).
 */
export async function getFavoriteGrapesForUser(
  userId: string,
): Promise<FavoriteGrapeRow[]> {
  const supabase = await createClient();

  const { data: favs, error: favError } = await supabase
    .from("favorites")
    .select("id, content_id, created_at")
    .eq("user_id", userId)
    .eq("content_type", "grape")
    .eq("module", "cepages")
    .order("created_at", { ascending: false });

  if (favError || !favs?.length) return [];

  const ids = favs.map((f) => f.content_id);
  const { data: grapes, error: gError } = await supabase
    .from("grapes")
    .select("id, slug, name_fr, name_en, type")
    .in("id", ids)
    .is("deleted_at", null);

  if (gError || !grapes) return [];

  const byId = new Map(grapes.map((g) => [g.id, g]));
  const out: FavoriteGrapeRow[] = [];
  for (const f of favs) {
    const g = byId.get(f.content_id);
    if (g) {
      out.push({ favoriteId: f.id, grape: g });
    }
  }
  return out;
}
