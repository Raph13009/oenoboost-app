import { createClient } from "@/lib/supabase/server";
import type { SoilType } from "../types";

export async function isSoilFavorited(userId: string, soilId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", userId)
    .eq("content_type", "soil_type")
    .eq("content_id", soilId)
    .eq("module", "sols")
    .maybeSingle();

  if (error) {
    return false;
  }

  return Boolean(data?.id);
}

export type FavoriteSoilRow = {
  favoriteId: string;
  soil: Pick<SoilType, "id" | "slug" | "name_fr">;
};

export async function getFavoriteSoilsForUser(
  userId: string,
): Promise<FavoriteSoilRow[]> {
  const supabase = await createClient();

  const { data: favs, error: favError } = await supabase
    .from("favorites")
    .select("id, content_id, created_at")
    .eq("user_id", userId)
    .eq("content_type", "soil_type")
    .eq("module", "sols")
    .order("created_at", { ascending: false });

  if (favError || !favs?.length) return [];

  const ids = favs.map((f) => f.content_id);
  const { data: soils, error: sError } = await supabase
    .from("soil_types")
    .select("id, slug, name_fr")
    .in("id", ids)
    .eq("status", "published")
    .is("deleted_at", null);

  if (sError || !soils) return [];

  const byId = new Map(soils.map((s) => [s.id, s]));
  const out: FavoriteSoilRow[] = [];
  for (const f of favs) {
    const s = byId.get(f.content_id);
    if (s) {
      out.push({ favoriteId: f.id, soil: s });
    }
  }
  return out;
}
