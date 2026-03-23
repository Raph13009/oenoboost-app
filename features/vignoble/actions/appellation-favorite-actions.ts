"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import {
  getTotalFavoritesCount,
} from "@/features/favorites/queries/favorites.queries";
import {
  isPremiumPlan,
  MAX_FREE_FAVORITES,
} from "@/lib/favorites/constants";

export type ToggleAppellationFavoriteResult =
  | { ok: true; favorited: boolean }
  | {
      ok: false;
      error: string;
      code?: "unauthorized" | "limit_reached";
    };

export async function toggleAppellationFavoriteAction(
  appellationId: string,
  regionSlug: string,
  aopSlug: string,
  subregionSlug: string,
): Promise<ToggleAppellationFavoriteResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "unauthorized", code: "unauthorized" };
  }

  const { data: existing, error: selError } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("content_type", "appellation")
    .eq("content_id", appellationId)
    .eq("module", "vignoble")
    .maybeSingle();

  if (selError) {
    return { ok: false, error: selError.message };
  }

  const detailSegmentPath = `/vignoble/${regionSlug}/${aopSlug}`;
  const subregionListPath = `/vignoble/${regionSlug}/${subregionSlug}`;

  if (existing) {
    const { error: delError } = await supabase
      .from("favorites")
      .delete()
      .eq("id", existing.id);

    if (delError) return { ok: false, error: delError.message };

    revalidatePath("/profil/favoris");
    revalidatePath(detailSegmentPath);
    revalidatePath(subregionListPath);
    revalidatePath("/vignoble/aop");
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

  const { error: insError } = await supabase.from("favorites").insert({
    user_id: user.id,
    content_type: "appellation",
    content_id: appellationId,
    module: "vignoble",
  });

  if (insError) {
    return { ok: false, error: insError.message };
  }

  revalidatePath("/profil/favoris");
  revalidatePath(detailSegmentPath);
  revalidatePath(subregionListPath);
  revalidatePath("/vignoble/aop");
  return { ok: true, favorited: true };
}
