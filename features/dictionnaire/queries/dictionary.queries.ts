import { createClient } from "@/lib/supabase/server";
import type { DictionaryTerm } from "../types";

const COLUMNS =
  "id, slug, term_fr, term_en, definition_fr, definition_en, examples_fr, examples_en, etymology_fr, etymology_en, related_modules, is_word_of_day, is_premium, free_order, status, published_at, created_at, updated_at, deleted_at";

function parseRelatedModules(raw: unknown): string[] | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === "string");
  }
  return null;
}

export async function getPublishedDictionaryTerms(): Promise<DictionaryTerm[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dictionary_terms")
    .select(COLUMNS)
    .eq("status", "published")
    .is("deleted_at", null)
    .order("term_fr", { ascending: true, nullsFirst: false });

  if (error) {
    throw new Error(`Failed to fetch dictionary terms: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    ...(row as Omit<DictionaryTerm, "related_modules">),
    related_modules: parseRelatedModules(
      (row as { related_modules?: unknown }).related_modules,
    ),
  })) as DictionaryTerm[];
}
