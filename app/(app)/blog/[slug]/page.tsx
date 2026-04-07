import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BlogArticleBody } from "@/features/blog/components/blog-article-body";
import { getPublishedNewsArticleBySlug } from "@/features/blog/queries/news-articles.queries";
import { getCurrentUser } from "@/lib/auth/session";
import { getContent } from "@/lib/i18n/get-content";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getServerLocale } from "@/lib/i18n/server";

export const revalidate = 120;

function formatArticleMonthYear(iso: string | null, locale: "fr" | "en"): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "fr-FR", {
    month: "long",
    year: "numeric",
  }).format(d);
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);
  const article = await getPublishedNewsArticleBySlug(slug);
  if (!article) {
    return { title: dict.blog.title };
  }
  const title = getContent(article, "title", locale);
  const excerpt = getContent(article, "excerpt", locale);
  return {
    title: `${title} — OenoBoost`,
    description: excerpt || dict.blog.subtitle,
  };
}

const ARTICLE_PROSE_CLASS =
  "space-y-4 [&_a]:text-wine [&_a]:underline [&_a]:underline-offset-4 [&_h1]:font-heading [&_h1]:text-3xl [&_h1]:font-semibold [&_h2]:font-heading [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:font-heading [&_h3]:text-xl [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-[15px] [&_p]:leading-relaxed [&_strong]:font-semibold";

export default async function BlogArticlePage({ params }: Props) {
  const { slug } = await params;
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);
  const user = await getCurrentUser();
  const article = await getPublishedNewsArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  const userPlan = user?.plan === "premium" ? "premium" : "free";
  const title = getContent(article, "title", locale);
  const excerpt = getContent(article, "excerpt", locale);
  const content = getContent(article, "content", locale);
  const dateLabel = formatArticleMonthYear(article.published_at, locale);
  const isPremiumArticle = article.is_premium_early;

  return (
    <article className="mx-auto max-w-[720px] pb-12">
      <Link
        href="/blog"
        className="mb-6 inline-block text-sm font-medium text-wine underline-offset-4 hover:underline"
      >
        ← {dict.blog.backToBlog}
      </Link>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {article.module_tag ? (
            <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide text-wine">
              {article.module_tag}
            </span>
          ) : null}
          {isPremiumArticle ? (
            <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
              {dict.blog.premiumBadge}
            </span>
          ) : null}
          {dateLabel ? (
            <time dateTime={article.published_at ?? undefined}>{dateLabel}</time>
          ) : null}
        </div>
        <h1 className="font-heading text-3xl font-semibold leading-tight text-wine md:text-4xl">
          {title}
        </h1>
        {excerpt ? (
          <p className="text-lg leading-relaxed text-muted-foreground">{excerpt}</p>
        ) : null}
      </header>

      {article.cover_url ? (
        <div className="relative mt-8 aspect-[16/9] w-full overflow-hidden rounded-xl border border-border bg-muted">
          <Image
            src={article.cover_url}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width: 720px) 100vw, 720px"
            priority
          />
        </div>
      ) : null}

      <div className="mt-8 text-[15px] leading-relaxed text-foreground md:text-base">
        {content ? (
          isPremiumArticle ? (
            <BlogArticleBody
              html={content}
              isPremium
              userPlan={userPlan}
              lockedTitle={dict.blog.articleLockedTitle}
              lockedBody={dict.blog.articleLockedBody}
            />
          ) : (
            <div
              className={ARTICLE_PROSE_CLASS}
              dangerouslySetInnerHTML={{ __html: content }}
            />
          )
        ) : (
          <p className="text-muted-foreground">{dict.blog.detailSoon}</p>
        )}
      </div>
    </article>
  );
}
