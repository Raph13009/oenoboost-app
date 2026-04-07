"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

import type { NewsArticleListItem } from "../types";
import type { Locale } from "@/lib/i18n/config";
import { getContent } from "@/lib/i18n/get-content";
import { cn } from "@/lib/utils";

type BlogLabels = {
  allTopics: string;
  empty: string;
  premiumBadge: string;
};

function formatArticleMonthYear(
  iso: string | null,
  locale: Locale,
): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "fr-FR", {
    month: "long",
    year: "numeric",
  }).format(d);
}

export function BlogIndex({
  articles,
  locale,
  labels,
}: {
  articles: NewsArticleListItem[];
  locale: Locale;
  labels: BlogLabels;
}) {
  const searchParams = useSearchParams();
  const activeTag = searchParams.get("tag");

  const moduleTags = useMemo(() => {
    const set = new Set<string>();
    for (const a of articles) {
      if (a.module_tag?.trim()) set.add(a.module_tag.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b, locale));
  }, [articles, locale]);

  const filtered = useMemo(() => {
    if (!activeTag) return articles;
    return articles.filter((a) => a.module_tag === activeTag);
  }, [articles, activeTag]);

  return (
    <div className="flex flex-col gap-8">
      {moduleTags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <FilterChip
            href="/blog"
            active={!activeTag}
            label={labels.allTopics}
          />
          {moduleTags.map((tag) => (
            <FilterChip
              key={tag}
              href={`/blog?tag=${encodeURIComponent(tag)}`}
              active={activeTag === tag}
              label={tag}
            />
          ))}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="text-[15px] text-muted-foreground">{labels.empty}</p>
      ) : (
        <ul className="mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((article, index) => (
            <li key={article.slug}>
              <BlogArticleCard
                article={article}
                locale={locale}
                index={index}
                premiumBadge={labels.premiumBadge}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-wine bg-accent text-wine"
          : "border-border bg-card text-foreground hover:border-wine/40 hover:bg-accent/80",
      )}
    >
      {label}
    </Link>
  );
}

function BlogArticleCard({
  article,
  locale,
  index,
  premiumBadge,
}: {
  article: NewsArticleListItem;
  locale: Locale;
  index: number;
  premiumBadge: string;
}) {
  const title = getContent(article, "title", locale);
  const excerpt = getContent(article, "excerpt", locale);
  const dateLabel = formatArticleMonthYear(article.published_at, locale);

  return (
    <Link
      href={`/blog/${article.slug}`}
      className={cn(
        "blog-card-enter group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md",
      )}
      style={{ animationDelay: `${Math.min(index, 12) * 55}ms` }}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
        {article.cover_url ? (
          <Image
            src={article.cover_url}
            alt=""
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-background text-muted-foreground"
            aria-hidden
          >
            <span className="font-heading text-2xl text-wine/25">O</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {article.module_tag ? (
            <span className="inline-flex max-w-full truncate rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-wine">
              {article.module_tag}
            </span>
          ) : null}
          {article.is_premium_early ? (
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {premiumBadge}
            </span>
          ) : null}
          {dateLabel ? (
            <time
              dateTime={article.published_at ?? undefined}
              className="text-xs text-muted-foreground"
            >
              {dateLabel}
            </time>
          ) : null}
        </div>
        <h2 className="font-heading text-lg font-semibold leading-snug text-wine group-hover:underline group-hover:underline-offset-2">
          {title}
        </h2>
        {excerpt ? (
          <p className="line-clamp-2 text-[14px] leading-relaxed text-muted-foreground">
            {excerpt}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
