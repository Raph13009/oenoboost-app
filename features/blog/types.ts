export type NewsArticleListItem = {
  slug: string;
  title_fr: string;
  title_en: string;
  excerpt_fr: string | null;
  excerpt_en: string | null;
  cover_url: string | null;
  module_tag: string | null;
  published_at: string | null;
  /** DB column `is_premium_early` — premium article (gated for free users). */
  is_premium_early: boolean;
};

export type NewsArticleDetail = NewsArticleListItem & {
  content_fr: string | null;
  content_en: string | null;
};
