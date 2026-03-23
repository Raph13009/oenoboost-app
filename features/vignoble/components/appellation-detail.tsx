import type { Appellation } from "../types";
import type { Locale } from "@/lib/i18n/config";
import { getContent } from "@/lib/i18n/get-content";

type AppellationDetailProps = {
  appellation: Appellation;
  locale: Locale;
};

export function AppellationDetail({
  appellation,
  locale,
}: AppellationDetailProps) {
  const name = getContent(appellation, "name", locale);
  const history = getContent(appellation, "history", locale);
  const colorsGrapes = getContent(appellation, "colors_grapes", locale);
  const soils = getContent(appellation, "soils_description", locale);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-3xl font-semibold md:text-4xl">
          {name}
        </h1>

        <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
          {appellation.area_hectares && (
            <span>{Number(appellation.area_hectares).toLocaleString(locale)} ha</span>
          )}
          {appellation.producer_count && (
            <span>
              {appellation.producer_count.toLocaleString(locale)}{" "}
              {locale === "fr" ? "producteurs" : "producers"}
            </span>
          )}
          {appellation.price_range_min_eur &&
            appellation.price_range_max_eur && (
              <span>
                {Number(appellation.price_range_min_eur)}€ –{" "}
                {Number(appellation.price_range_max_eur)}€
              </span>
            )}
        </div>
      </div>

      {history && (
        <section>
          <h2 className="font-heading text-xl font-semibold">
            {locale === "fr" ? "Histoire" : "History"}
          </h2>
          <p className="mt-2 leading-relaxed text-foreground/80">{history}</p>
        </section>
      )}

      {colorsGrapes && (
        <section>
          <h2 className="font-heading text-xl font-semibold">
            {locale === "fr" ? "Couleurs & Cépages" : "Colors & Grapes"}
          </h2>
          <p className="mt-2 leading-relaxed text-foreground/80">
            {colorsGrapes}
          </p>
        </section>
      )}

      {soils && (
        <section>
          <h2 className="font-heading text-xl font-semibold">
            {locale === "fr" ? "Sols" : "Soils"}
          </h2>
          <p className="mt-2 leading-relaxed text-foreground/80">{soils}</p>
        </section>
      )}
    </div>
  );
}
