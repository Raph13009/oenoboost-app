import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getRegionBySlug } from "@/features/vignoble/queries/regions.queries";
import { getSubregionBySlug } from "@/features/vignoble/queries/subregions.queries";
import { getAppellations } from "@/features/vignoble/queries/appellations.queries";
import { AppellationCard } from "@/features/vignoble/components/appellation-card";
import { AppellationDetail } from "@/features/vignoble/components/appellation-detail";
import { getAopDetailByRegionAndSlug } from "@/features/vignoble/queries/aop-navigation.queries";
import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getContent } from "@/lib/i18n/get-content";

type Props = {
  params: Promise<{ region: string; subregion: string }>;
  searchParams?: Promise<{
    from?: string;
    subregion?: string;
    listRegion?: string;
    listSubregion?: string;
  }>;
};

export default async function RegionSubregionOrAopPage({
  params,
  searchParams,
}: Props) {
  const { region: regionSlug, subregion: slug } = await params;
  const qp = (await searchParams) ?? {};
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);

  const region = await getRegionBySlug(regionSlug);
  if (!region) notFound();

  const subregion = await getSubregionBySlug(slug);
  if (subregion && subregion.region_id === region.id) {
    const appellations = await getAppellations(subregion.id);
    const subregionName = getContent(subregion, "name", locale);

    return (
      <div className="flex flex-col gap-6">
        <div>
          <Link
            href={`/vignoble/${regionSlug}`}
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-wine"
          >
            <ArrowLeft className="h-4 w-4" />
            {dict.vignoble.backToSubregions}
          </Link>

          <h1 className="font-heading text-3xl font-semibold md:text-4xl">
            {subregionName}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {dict.vignoble.appellations}
          </p>
        </div>

        {appellations.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">
            {dict.common.empty}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {appellations.map((aop) => (
              <AppellationCard
                key={aop.id}
                appellation={aop}
                regionSlug={regionSlug}
                subregionSlug={subregion.slug}
                locale={locale}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const aop = await getAopDetailByRegionAndSlug(regionSlug, slug);
  if (!aop) notFound();
  const isFromList = qp.from === "list";
  const backHref = (() => {
    if (isFromList) {
      const params = new URLSearchParams();
      if (qp.listRegion) params.set("region", qp.listRegion);
      if (qp.listSubregion) params.set("subregion", qp.listSubregion);
      const q = params.toString();
      return q ? `/vignoble/aop?${q}` : "/vignoble/aop";
    }
    if (qp.from === "map" && qp.subregion) {
      return `/vignoble?region=${regionSlug}&subregion=${qp.subregion}`;
    }
    return `/vignoble?region=${regionSlug}&subregion=${aop.subregion.slug}`;
  })();
  const backLabel = isFromList
    ? locale === "fr"
      ? "Retour à la liste"
      : "Back to list"
    : dict.vignoble.backToMap;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
        {!isFromList && (
          <Link
            href="/vignoble/aop"
            className="inline-flex items-center justify-center rounded-full bg-wine px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-wine/90"
          >
            {dict.vignoble.viewAllAops}
          </Link>
        )}
      </div>

      <AppellationDetail appellation={aop.appellation} locale={locale} />
    </div>
  );
}
