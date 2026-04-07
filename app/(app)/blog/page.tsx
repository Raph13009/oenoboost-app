import { Suspense } from "react";

import { BlogIndex } from "@/features/blog/components/blog-index";
import { getPublishedNewsArticles } from "@/features/blog/queries/news-articles.queries";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getServerLocale } from "@/lib/i18n/server";

export const revalidate = 60;

export async function generateMetadata() {
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);
  return {
    title: `${dict.blog.title} — OenoBoost`,
    description: dict.blog.subtitle,
  };
}

function BlogGridFallback() {
  return (
    <div className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-[320px] animate-pulse rounded-xl border border-border bg-muted/60"
        />
      ))}
    </div>
  );
}

export default async function BlogPage() {
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);
  const articles = await getPublishedNewsArticles();

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-8 pb-8">
      <header className="flex max-w-2xl flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold text-wine md:text-4xl">
          {dict.blog.title}
        </h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground md:text-base">
          {dict.blog.subtitle}
        </p>
      </header>

      <Suspense fallback={<BlogGridFallback />}>
        <BlogIndex
          articles={articles}
          locale={locale}
          labels={{
            allTopics: dict.blog.allTopics,
            empty: dict.blog.empty,
            premiumBadge: dict.blog.premiumBadge,
          }}
        />
      </Suspense>
    </div>
  );
}
