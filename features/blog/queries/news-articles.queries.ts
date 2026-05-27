import { createClient } from "@/lib/supabase/server";
import type { NewsArticleDetail, NewsArticleListItem } from "../types";

const LIST_COLUMNS =
  "slug, title_fr, title_en, excerpt_fr, excerpt_en, cover_url, module_tag, published_at, is_premium_early";

export async function getPublishedNewsArticles(): Promise<NewsArticleListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news_articles")
    .select(LIST_COLUMNS)
    .is("deleted_at", null)
    .order("published_at", { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error(`Failed to fetch news articles: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    ...(row as NewsArticleListItem),
    is_premium_early: Boolean(
      (row as { is_premium_early?: boolean | null }).is_premium_early,
    ),
  }));
}

export async function getPublishedNewsArticleBySlug(
  slug: string,
): Promise<NewsArticleDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news_articles")
    .select(
      `${LIST_COLUMNS}, content_fr, content_en`,
    )
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch news article: ${error.message}`);
  }

  if (!data) return null;

  return {
    ...(data as NewsArticleDetail),
    is_premium_early: Boolean(
      (data as { is_premium_early?: boolean | null }).is_premium_early,
    ),
  };
}
