import { createClient } from "@/lib/supabase/server";
import type { VinificationStep, VinificationType } from "../types";

const COLUMNS =
  "id, slug, name_fr, name_en, illustration_url, carousel_order, is_premium, status, published_at, created_at, updated_at, deleted_at";

export async function getPublishedVinificationTypes(): Promise<VinificationType[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vinification_types")
    .select(COLUMNS)
    .eq("status", "published")
    .is("deleted_at", null)
    .order("carousel_order", { ascending: true, nullsFirst: false });

  if (error) {
    throw new Error(`Failed to fetch vinification types: ${error.message}`);
  }

  return (data ?? []) as VinificationType[];
}

export async function getVinificationTypeBySlug(
  slug: string,
): Promise<VinificationType | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vinification_types")
    .select(COLUMNS)
    .eq("slug", slug)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch vinification type: ${error.message}`);
  }

  return (data ?? null) as VinificationType | null;
}

const STEP_COLUMNS =
  "id, vinification_type_id, step_order, icon_url, title_fr, title_en, summary_fr, summary_en, detail_fr, detail_en, created_at, updated_at";

export async function getVinificationStepsForType(
  vinificationTypeId: string,
): Promise<VinificationStep[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vinification_steps")
    .select(STEP_COLUMNS)
    .eq("vinification_type_id", vinificationTypeId)
    .order("step_order", { ascending: true, nullsFirst: false });

  if (error) {
    throw new Error(`Failed to fetch vinification steps: ${error.message}`);
  }

  return (data ?? []) as VinificationStep[];
}
