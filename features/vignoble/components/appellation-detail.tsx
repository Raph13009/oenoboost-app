import type { Appellation } from "../types";
import type { Locale } from "@/lib/i18n/config";
import { getContent } from "@/lib/i18n/get-content";

import type { AppellationFavoriteLabels } from "./appellation-favorite-button";
import { AppellationFavoriteButton } from "./appellation-favorite-button";

type AppellationDetailProps = {
  appellation: Appellation;
  locale: Locale;
  favorite?: {
    appellationId: string;
    regionSlug: string;
    subregionSlug: string;
    aopSlug: string;
    initialFavorited: boolean;
    isLoggedIn: boolean;
  };
  favoriteLabels?: AppellationFavoriteLabels;
};

export function AppellationDetail({
  appellation,
  locale,
  favorite,
  favoriteLabels,
}: AppellationDetailProps) {
  const name = getContent(appellation, "name", locale);
  const history = getContent(appellation, "history", locale);
  const colorsGrapes = getContent(appellation, "colors_grapes", locale);
  const soils = getContent(appellation, "soils_description", locale);
  const na = "...";
  const formatNumber = (value: number | null) =>
    value === null ? na : Number(value).toLocaleString(locale);
  const formatPriceRange = () => {
    if (
      appellation.price_range_min_eur === null ||
      appellation.price_range_max_eur === null
    ) {
      return na;
    }
    return `${Number(appellation.price_range_min_eur)}€ - ${Number(
      appellation.price_range_max_eur,
    )}€`;
  };

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <div className="rounded-2xl border border-border bg-card px-4 py-5 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="font-heading text-3xl font-semibold text-wine md:text-4xl">
            {locale === "fr" ? "AOP" : "AOP"} {name}
          </h1>
          {favorite && favoriteLabels && (
            <AppellationFavoriteButton
              appellationId={favorite.appellationId}
              regionSlug={favorite.regionSlug}
              aopSlug={favorite.aopSlug}
              subregionSlug={favorite.subregionSlug}
              initialFavorited={favorite.initialFavorited}
              isLoggedIn={favorite.isLoggedIn}
              labels={favoriteLabels}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
        <section className="rounded-xl border border-border bg-card p-4 md:p-5">
          <h2 className="font-heading text-xl font-semibold">
            {locale === "fr" ? "Chiffres clés" : "Key figures"}
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border/70 bg-background p-3">
              <p className="text-xs text-muted-foreground">
                {locale === "fr" ? "Surface" : "Area"}
              </p>
              <p className="mt-1 text-sm font-medium">
                {formatNumber(appellation.area_hectares)}{" "}
                {appellation.area_hectares === null ? "" : "ha"}
              </p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background p-3">
              <p className="text-xs text-muted-foreground">
                {locale === "fr" ? "Producteurs" : "Producers"}
              </p>
              <p className="mt-1 text-sm font-medium">
                {formatNumber(appellation.producer_count)}
              </p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background p-3">
              <p className="text-xs text-muted-foreground">
                {locale === "fr" ? "Production" : "Production"}
              </p>
              <p className="mt-1 text-sm font-medium">
                {formatNumber(appellation.production_volume_hl)}{" "}
                {appellation.production_volume_hl === null ? "" : "hl"}
              </p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background p-3">
              <p className="text-xs text-muted-foreground">
                {locale === "fr" ? "Prix" : "Price range"}
              </p>
              <p className="mt-1 text-sm font-medium">{formatPriceRange()}</p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 md:p-5">
          <h2 className="font-heading text-xl font-semibold">
            {locale === "fr" ? "Couleurs & Cépages" : "Colors & Grapes"}
          </h2>
          <p className="mt-3 whitespace-pre-line leading-relaxed text-foreground/85">
            {colorsGrapes || na}
          </p>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 md:p-5">
          <h2 className="font-heading text-xl font-semibold">
            {locale === "fr" ? "Histoire" : "History"}
          </h2>
          <p className="mt-3 max-w-prose leading-relaxed text-foreground/85">
            {history || na}
          </p>
        </section>

        <section className="rounded-xl border border-border bg-card p-4 md:p-5">
          <h2 className="font-heading text-xl font-semibold">
            {locale === "fr" ? "Sols" : "Soils"}
          </h2>
          <p className="mt-3 whitespace-pre-line leading-relaxed text-foreground/85">
            {soils || na}
          </p>
        </section>
      </div>
    </div>
  );
}
