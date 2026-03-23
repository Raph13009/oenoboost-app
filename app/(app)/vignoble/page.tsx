import { getServerLocale } from "@/lib/i18n/server";
import { getRegions } from "@/features/vignoble/queries/get-regions";
import { VignobleMap } from "@/features/vignoble/components/vignoble-map";

export const metadata = {
  title: "Vignoble — OenoBoost",
};

export default async function VignoblePage() {
  const locale = await getServerLocale();
  // Locale is currently only used to choose region names in the map features.

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
    }));

  return (
    // Root layout adds top/bottom padding (`pt-8 pb-16` in app/layout.tsx).
    // Subtract them so the map fills the remaining viewport and the page stays non-scrollable.
    <div className="h-[calc(100vh-3.5rem-2rem-4rem)] overflow-hidden">
      <div className="h-full p-3">
        <VignobleMap regions={mapRegions} heightClassName="h-full" />
      </div>
    </div>
  );
}
