import { getContent } from "@/lib/i18n/get-content";
import type { Locale } from "@/lib/i18n/config";
import type { Grape } from "../types";

type GrapeDetailProps = {
  grape: Grape;
  locale: Locale;
  labels: {
    origin: string;
    history: string;
    characteristics: string;
    tasting: string;
    productionRegions: string;
    crossings: string;
    emblematicWines: string;
    grapeMap: string;
    mapPlaceholder: string;
    red: string;
    white: string;
    rose: string;
  };
};

export function GrapeDetail({ grape, locale, labels }: GrapeDetailProps) {
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

  const cards = [
    { title: labels.origin, content: `${grape.origin_country ?? na}${originRegion ? ` — ${originRegion}` : ""}` },
    { title: labels.history, content: history || na },
    { title: labels.characteristics, content: viticultural || na },
    { title: labels.tasting, content: tasting || na },
    { title: labels.productionRegions, content: production || na },
    { title: labels.crossings, content: crossings || na },
    { title: labels.emblematicWines, content: wines || na },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-border bg-card px-4 py-5 md:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-3xl font-semibold text-wine md:text-4xl">
            {name}
          </h1>
          <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
            {typeLabel}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <section
            key={card.title}
            className="rounded-xl border border-border bg-card p-4 md:p-5"
          >
            <h2 className="font-heading text-xl font-semibold">{card.title}</h2>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-foreground/85">
              {card.content}
            </p>
          </section>
        ))}

        <section className="rounded-xl border border-border bg-card p-4 md:p-5">
          <h2 className="font-heading text-xl font-semibold">{labels.grapeMap}</h2>
          <div className="mt-3 rounded-lg border border-dashed border-border bg-background p-8 text-center text-sm text-muted-foreground">
            {labels.mapPlaceholder}
          </div>
        </section>
      </div>
    </div>
  );
}
