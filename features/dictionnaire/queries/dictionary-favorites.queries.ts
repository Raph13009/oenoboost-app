import { createClient } from "@/lib/supabase/server";

export async function getDictionaryTermFavoriteIds(
  userId: string,
): Promise<Set<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("favorites")
    .select("content_id")
    .eq("user_id", userId)
    .eq("content_type", "dictionary_term")
    .eq("module", "dictionnaire");

  if (error || !data) {
    return new Set();
  }

  return new Set(data.map((r) => r.content_id as string));
}
