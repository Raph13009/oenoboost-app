"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTotalFavoritesCount } from "@/features/favorites/queries/favorites.queries";
import { isPremiumPlan, MAX_FREE_FAVORITES } from "@/lib/favorites/constants";

export type ToggleSoilFavoriteResult =
  | { ok: true; favorited: boolean }
  | {
      ok: false;
      error: string;
      code?: "unauthorized" | "limit_reached";
    };

export async function toggleSoilFavoriteAction(
  soilId: string,
  soilSlug: string,
): Promise<ToggleSoilFavoriteResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "unauthorized", code: "unauthorized" };
  }

  const { data: existing, error: selectError } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("content_type", "soil_type")
    .eq("content_id", soilId)
    .eq("module", "sols")
    .maybeSingle();

  if (selectError) {
    return { ok: false, error: selectError.message };
  }

  const detailPath = `/sols/${soilSlug}`;

  if (existing) {
    const { error: deleteError } = await supabase
      .from("favorites")
      .delete()
      .eq("id", existing.id);

    if (deleteError) {
      return { ok: false, error: deleteError.message };
    }

    revalidatePath("/profil/favoris");
    revalidatePath("/sols");
    revalidatePath(detailPath);
    return { ok: true, favorited: false };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle();

  if (!isPremiumPlan(profile?.plan)) {
    const total = await getTotalFavoritesCount(user.id);
    if (total >= MAX_FREE_FAVORITES) {
      return { ok: false, error: "limit_reached", code: "limit_reached" };
    }
  }

  const { error: insertError } = await supabase.from("favorites").insert({
    user_id: user.id,
    content_type: "soil_type",
    content_id: soilId,
    module: "sols",
  });

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  revalidatePath("/profil/favoris");
  revalidatePath("/sols");
  revalidatePath(detailPath);
  return { ok: true, favorited: true };
}
