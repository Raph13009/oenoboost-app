"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";
import type { AopBrowseItem } from "@/features/vignoble/queries/aop-navigation.queries";
import type { AppellationFavoriteLabels } from "./appellation-favorite-button";
import { AppellationFavoriteButton } from "./appellation-favorite-button";

type Props = {
  item: AopBrowseItem;
  locale: Locale;
  href: string;
  initialFavorited: boolean;
  isLoggedIn: boolean;
  favoriteLabels: AppellationFavoriteLabels;
};

export function AopBrowseCard({
  item,
  locale,
  href,
  initialFavorited,
  isLoggedIn,
  favoriteLabels,
}: Props) {
  const name = locale === "fr" ? item.name_fr : item.name_en;
  const regionName = locale === "fr" ? item.region_name_fr : item.region_name_en;
  const subName =
    locale === "fr" ? item.subregion_name_fr : item.subregion_name_en;

  return (
    <div className="group flex items-stretch overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-wine/20">
      <Link href={href} className="flex min-w-0 flex-1 items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="font-heading text-base">{name}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {regionName}
            {" • "}
            {subName}
          </div>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-wine" />
      </Link>
      <div className="flex shrink-0 items-center border-l border-border/50 px-2">
        <AppellationFavoriteButton
          appellationId={item.id}
          regionSlug={item.region_slug}
          aopSlug={item.slug}
          subregionSlug={item.subregion_slug}
          initialFavorited={initialFavorited}
          isLoggedIn={isLoggedIn}
          labels={favoriteLabels}
          size="sm"
        />
      </div>
    </div>
  );
}
