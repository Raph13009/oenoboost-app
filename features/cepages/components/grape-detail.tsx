import { getContent } from "@/lib/i18n/get-content";
import type { Locale } from "@/lib/i18n/config";
import type { Grape } from "../types";
import { GrapeDetailSection } from "./grape-detail-section";
import type { GrapeFavoriteLabels } from "./grape-favorite-button";
import { GrapeFavoriteButton } from "./grape-favorite-button";
import { GrapeGlobeMap } from "./grape-globe-map";

type GrapeDetailProps = {
  grape: Grape;
  locale: Locale;
  favorite: {
    grapeId: string;
    grapeSlug: string;
    initialFavorited: boolean;
    isLoggedIn: boolean;
  };
  favoriteLabels: GrapeFavoriteLabels;
  labels: {
    origin: string;
    history: string;
    characteristics: string;
    tasting: string;
    productionRegions: string;
    crossings: string;
    emblematicWines: string;
    grapeGlobe: string;
    mapUnavailable: string;
    red: string;
    white: string;
    rose: string;
  };
};

/** Mobile: Origine → Histoire → Globe (3ᵉ) → … — Desktop: globe en haut à droite, 2 lignes de hauteur. */
export function GrapeDetail({
  grape,
  locale,
  favorite,
  favoriteLabels,
  labels,
}: GrapeDetailProps) {
  const name = getContent(grape, "name", locale);
  const originRegion = getContent(grape, "origin_region", locale);
  const history = getContent(grape, "history", locale);
  const viticultural = getContent(grape, "viticultural_traits", locale);
  const tasting = getContent(grape, "tasting_traits", locale);
  const production = getContent(grape, "production_regions", locale);
  const crossings = getContent(grape, "crossings", locale);
  const wines = getContent(grape, "emblematic_wines", locale);

  const typeLabel =
    grape.type === "red" ? labels.red : grape.type === "white" ? labels.white : labels.rose;
  const na = "...";

  const textClass = "whitespace-pre-line leading-relaxed text-foreground/85";

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-border bg-card px-4 py-5 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <h1 className="font-heading text-3xl font-semibold text-wine md:text-4xl">
              {name}
            </h1>
            <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
              {typeLabel}
            </span>
          </div>
          <GrapeFavoriteButton
            grapeId={favorite.grapeId}
            grapeSlug={favorite.grapeSlug}
            initialFavorited={favorite.initialFavorited}
            isLoggedIn={favorite.isLoggedIn}
            labels={favoriteLabels}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        <GrapeDetailSection title={labels.origin} className="md:col-start-1 md:row-start-1">
          <p className={textClass}>
            {`${grape.origin_country ?? na}${originRegion ? ` — ${originRegion}` : ""}`}
          </p>
        </GrapeDetailSection>

        <GrapeDetailSection title={labels.history} className="md:col-start-1 md:row-start-2">
          <p className={textClass}>{history || na}</p>
        </GrapeDetailSection>

        <GrapeDetailSection
          title={labels.grapeGlobe}
          className="flex min-h-0 flex-col md:col-start-2 md:row-span-2 md:row-start-1 md:h-full"
          contentClassName="flex min-h-0 flex-1 flex-col"
        >
          <GrapeGlobeMap
            productionCountries={grape.production_countries}
            mapUnavailable={labels.mapUnavailable}
            globeLabel={labels.grapeGlobe}
            layout="sidebar"
          />
        </GrapeDetailSection>

        <GrapeDetailSection
          title={labels.characteristics}
          className="md:col-start-1 md:row-start-3"
        >
          <p className={textClass}>{viticultural || na}</p>
        </GrapeDetailSection>
        <GrapeDetailSection title={labels.tasting} className="md:col-start-2 md:row-start-3">
          <p className={textClass}>{tasting || na}</p>
        </GrapeDetailSection>

        <GrapeDetailSection
          title={labels.productionRegions}
          className="md:col-start-1 md:row-start-4"
        >
          <p className={textClass}>{production || na}</p>
        </GrapeDetailSection>
        <GrapeDetailSection title={labels.crossings} className="md:col-start-2 md:row-start-4">
          <p className={textClass}>{crossings || na}</p>
        </GrapeDetailSection>

        <GrapeDetailSection
          title={labels.emblematicWines}
          className="md:col-span-2 md:row-start-5"
        >
          <p className={textClass}>{wines || na}</p>
        </GrapeDetailSection>
      </div>
    </div>
  );
}
