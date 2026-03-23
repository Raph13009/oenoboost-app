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

export type ToggleGrapeFavoriteResult =
  | { ok: true; favorited: boolean }
  | {
      ok: false;
      error: string;
      code?: "unauthorized" | "limit_reached";
    };

export async function toggleGrapeFavoriteAction(
  grapeId: string,
  grapeSlug: string,
): Promise<ToggleGrapeFavoriteResult> {
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
    .eq("content_type", "grape")
    .eq("content_id", grapeId)
    .eq("module", "cepages")
    .maybeSingle();

  if (selError) {
    return { ok: false, error: selError.message };
  }

  if (existing) {
    const { error: delError } = await supabase
      .from("favorites")
      .delete()
      .eq("id", existing.id);

    if (delError) return { ok: false, error: delError.message };

    revalidatePath("/profil/favoris");
    revalidatePath(`/cepages/${grapeSlug}`);
    return { ok: true, favorited: false };
  }

  const { error: insError } = await supabase.from("favorites").insert({
    user_id: user.id,
    content_type: "grape",
    content_id: grapeId,
    module: "cepages",
  });

  if (insError) {
    return { ok: false, error: insError.message };
  }

  revalidatePath("/profil/favoris");
  revalidatePath(`/cepages/${grapeSlug}`);
  revalidatePath("/cepages");
  return { ok: true, favorited: true };
}
