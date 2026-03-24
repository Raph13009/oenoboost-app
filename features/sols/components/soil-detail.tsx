import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getContent } from "@/lib/i18n/get-content";
import type { Locale } from "@/lib/i18n/config";
import type { RelatedAop, SoilType } from "../types";
import type { SoilFavoriteLabels } from "./soil-favorite-button";
import { SoilFavoriteButton } from "./soil-favorite-button";
import { SoilCoverImage } from "./soil-cover-image";

type SoilDetailProps = {
  locale: Locale;
  soil: SoilType;
  relatedAops: RelatedAop[];
  emptyRelatedAopsLabel: string;
  favorite: {
    soilId: string;
    soilSlug: string;
    initialFavorited: boolean;
    isLoggedIn: boolean;
  };
  favoriteLabels: SoilFavoriteLabels;
  labels: {
    geologicalOrigin: string;
    regions: string;
    mineralComposition: string;
    influenceOnWine: string;
    relatedAops: string;
    premiumBadge: string;
  };
};

function DetailSection({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-xl border border-border bg-card p-4 md:p-5 ${className ?? ""}`}>
      <h2 className="font-heading text-xl font-semibold">{title}</h2>
      <div className="mt-3 text-foreground/85">{children}</div>
    </section>
  );
}

export function SoilDetail({
  locale,
  soil,
  relatedAops,
  emptyRelatedAopsLabel,
  favorite,
  favoriteLabels,
  labels,
}: SoilDetailProps) {
  const textClass = "whitespace-pre-line leading-relaxed";

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-col md:flex-row md:items-stretch">
          <div className="order-2 flex flex-1 flex-col justify-center gap-4 px-4 py-5 md:order-1 md:min-w-0 md:px-6 md:py-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <h1 className="font-heading text-3xl font-semibold text-wine md:text-4xl">
                  {soil.name_fr}
                </h1>
                {soil.is_premium && (
                  <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
                    {labels.premiumBadge}
                  </span>
                )}
              </div>

              <SoilFavoriteButton
                soilId={favorite.soilId}
                soilSlug={favorite.soilSlug}
                initialFavorited={favorite.initialFavorited}
                isLoggedIn={favorite.isLoggedIn}
                labels={favoriteLabels}
              />
            </div>
          </div>

          <div className="relative order-1 aspect-video w-full shrink-0 overflow-hidden md:order-2 md:w-[min(14rem,38vw)] lg:w-60">
            <SoilCoverImage
              photoUrl={soil.photo_url}
              alt={soil.name_fr}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 240px"
              className="object-cover object-left"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
        <DetailSection title={labels.geologicalOrigin}>
          <p className={textClass}>{soil.geological_origin_fr || "..."}</p>
        </DetailSection>

        <DetailSection title={labels.regions}>
          <p className={textClass}>{soil.regions_fr || "..."}</p>
        </DetailSection>

        <DetailSection title={labels.mineralComposition}>
          <p className={textClass}>{soil.mineral_composition_fr || "..."}</p>
        </DetailSection>

        <DetailSection title={labels.influenceOnWine}>
          <p className={textClass}>{soil.wine_influence_fr || "..."}</p>
        </DetailSection>

        <DetailSection title={labels.relatedAops} className="md:col-span-2">
          {relatedAops.length === 0 ? (
            <p className="text-muted-foreground">{emptyRelatedAopsLabel}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {relatedAops.map((aop) => {
                const name = getContent(
                  { name_fr: aop.name_fr, name_en: aop.name_en },
                  "name",
                  locale,
                );
                const qp = new URLSearchParams();
                qp.set("subregion", aop.subregion_slug);
                qp.set("from", "soil");
                qp.set("soilSlug", soil.slug);
                const href = `/vignoble/${aop.region_slug}/${aop.slug}?${qp.toString()}`;
                return (
                  <li key={aop.id}>
                    <Link
                      href={href}
                      className="group flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-foreground transition-colors hover:border-wine/20 hover:bg-muted/20"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {name}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        AOP
                      </span>
                      <ChevronRight
                        className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-wine"
                        aria-hidden
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </DetailSection>
      </div>
    </div>
  );
}
