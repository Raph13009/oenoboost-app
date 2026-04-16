import { createClient } from "@/lib/supabase/server";

export async function getTotalFavoritesCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("favorites")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) return 0;
  return count ?? 0;
}

export type FavoritedIds = {
  grapeIds: Set<string>;
  /** AOP ids stored as strings (favorites.content_id is text). */
  aopIds: Set<string>;
};

export async function getFavoritedContentIds(
  userId: string,
): Promise<FavoritedIds> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("favorites")
    .select("content_type, content_id")
    .eq("user_id", userId);

  const grapeIds = new Set<string>();
  const aopIds = new Set<string>();

  if (error || !data) {
    return { grapeIds, aopIds };
  }

  for (const row of data) {
    if (row.content_type === "grape") {
      grapeIds.add(row.content_id as string);
    } else if (row.content_type === "aop") {
      aopIds.add(row.content_id as string);
    }
  }

  return { grapeIds, aopIds };
}
