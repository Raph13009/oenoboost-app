import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getAopBrowseItems } from "@/features/vignoble/queries/aop-navigation.queries";
import { AopFilters } from "@/features/vignoble/components/aop-filters";

type Props = {
  searchParams?: Promise<{ region?: string; subregion?: string }>;
};

export default async function AopListPage({ searchParams }: Props) {
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);
  const qp = (await searchParams) ?? {};

  const data = await getAopBrowseItems({
    regionId: qp.region,
    subregionId: qp.subregion,
  });

  const availableSubregions = qp.region
    ? data.subregions.filter((s) => s.region_id === qp.region)
    : data.subregions;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/vignoble"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-wine"
        >
          <ArrowLeft className="h-4 w-4" />
          {dict.vignoble.backToRegions}
        </Link>
      </div>

      <div>
        <h1 className="font-heading text-3xl font-semibold md:text-4xl">
          {dict.vignoble.allAops}
        </h1>
      </div>

      <AopFilters
        locale={locale}
        regionLabel={dict.vignoble.regions}
        subregionLabel={dict.vignoble.subregions}
        selectedRegionId={qp.region ?? ""}
        selectedSubregionId={qp.subregion ?? ""}
        regions={data.regions}
        initialSubregions={availableSubregions}
      />

      {data.items.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          {dict.common.empty}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {data.items.map((item) => (
            (() => {
              const params = new URLSearchParams({
                from: "list",
                subregion: item.subregion_slug,
              });
              if (qp.region) params.set("listRegion", qp.region);
              if (qp.subregion) params.set("listSubregion", qp.subregion);
              const href = `/vignoble/${item.region_slug}/${item.slug}?${params.toString()}`;
              return (
            <Link
              key={item.id}
              href={href}
              className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-wine/20"
            >
              <div className="font-heading text-base">
                {locale === "fr" ? item.name_fr : item.name_en}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {locale === "fr" ? item.region_name_fr : item.region_name_en}
                {" • "}
                {locale === "fr"
                  ? item.subregion_name_fr
                  : item.subregion_name_en}
              </div>
            </Link>
              );
            })()
          ))}
        </div>
      )}
    </div>
  );
}
