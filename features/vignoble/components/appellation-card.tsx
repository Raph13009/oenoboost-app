"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Appellation } from "../types";
import type { Locale } from "@/lib/i18n/config";
import { getContent } from "@/lib/i18n/get-content";
import type { AppellationFavoriteLabels } from "./appellation-favorite-button";
import { AppellationFavoriteButton } from "./appellation-favorite-button";

type AppellationCardProps = {
  appellation: Appellation;
  regionSlug: string;
  subregionSlug: string;
  locale: Locale;
  initialFavorited: boolean;
  isLoggedIn: boolean;
  favoriteLabels: AppellationFavoriteLabels;
};

export function AppellationCard({
  appellation,
  regionSlug,
  subregionSlug,
  locale,
  initialFavorited,
  isLoggedIn,
  favoriteLabels,
}: AppellationCardProps) {
  const name = getContent(appellation, "name", locale);
  const href = `/vignoble/${regionSlug}/${appellation.slug}?subregion=${encodeURIComponent(subregionSlug)}`;

  return (
    <div className="group flex items-stretch overflow-hidden rounded-xl border border-border bg-card transition-all duration-200 hover:border-wine/20 hover:shadow-sm">
      <Link
        href={href}
        className="flex min-w-0 flex-1 items-center justify-between gap-3 p-5"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="font-heading text-base font-semibold">{name}</h2>
          {appellation.area_hectares && (
            <p className="text-xs text-muted-foreground">
              {Number(appellation.area_hectares).toLocaleString(locale)} ha
            </p>
          )}
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-wine" />
      </Link>
      <div className="flex shrink-0 items-center border-l border-border/50 px-2">
        <AppellationFavoriteButton
          appellationId={appellation.id}
          regionSlug={regionSlug}
          aopSlug={appellation.slug}
          subregionSlug={subregionSlug}
          initialFavorited={initialFavorited}
          isLoggedIn={isLoggedIn}
          labels={favoriteLabels}
          size="sm"
        />
      </div>
    </div>
  );
}
