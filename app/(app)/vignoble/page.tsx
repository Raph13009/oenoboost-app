import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getRegions } from "@/features/vignoble/queries/get-regions";
import { VignobleMap } from "@/features/vignoble/components/vignoble-map";

export const metadata = {
  title: "Vignoble — OenoBoost",
};

export default async function VignoblePage({
  searchParams,
}: {
  searchParams?: Promise<{ region?: string; subregion?: string }>;
}) {
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);
  const qp = (await searchParams) ?? {};

  const regions = await getRegions();

  const mapRegions = regions
    .filter(
      (r): r is (typeof regions)[number] & { geojson: unknown } =>
      Boolean(r.geojson),
    )
    .map((r) => ({
      region_id: r.id,
      region_slug: r.slug,
      name: locale === "en" ? r.name_en : r.name_fr,
      geojson: r.geojson,
      color_hex: r.color_hex,
      department_count: r.department_count,
      area_hectares: r.area_hectares,
      total_production_hl: r.total_production_hl,
    }));

  return (
    // Full-bleed viewport below the sticky header.
    // We cancel the app layout padding here so the vignoble page always fits in one screen on mobile.
    <div className="-mx-6 -mt-5 -mb-8 h-[calc(100dvh-3.5rem)] overflow-hidden overscroll-none lg:-mx-8">
      <div className="h-full p-1.5 md:p-1">
        <VignobleMap
          regions={mapRegions}
          heightClassName="h-full"
          locale={locale}
          initialRegionSlug={qp.region}
          initialSubregionSlug={qp.subregion}
          strings={{
            discover: dict.vignoble.discover,
            backToRegions: dict.vignoble.backToRegions,
            backToRegion: dict.vignoble.backToRegion,
            departmentsLabel: dict.vignoble.departmentCount,
            hectaresLabel: dict.vignoble.hectares,
            totalProductionLabel: dict.vignoble.totalProduction,
            closeLabel: dict.common.close,
            na: dict.common.na,
          }}
        />
      </div>
    </div>
  );
}
