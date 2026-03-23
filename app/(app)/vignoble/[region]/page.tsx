import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getRegionBySlug } from "@/features/vignoble/queries/regions.queries";
import { getSubregions } from "@/features/vignoble/queries/subregions.queries";
import { SubregionCard } from "@/features/vignoble/components/subregion-card";
import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getContent } from "@/lib/i18n/get-content";

type Props = {
  params: Promise<{ region: string }>;
};

export default async function RegionPage({ params }: Props) {
  const { region: regionSlug } = await params;
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);

  const region = await getRegionBySlug(regionSlug);
  if (!region) notFound();

  const subregions = await getSubregions(region.id);
  const regionName = getContent(region, "name", locale);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/vignoble"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-wine"
        >
          <ArrowLeft className="h-4 w-4" />
          {dict.vignoble.backToRegions}
        </Link>

        <h1 className="font-heading text-3xl font-semibold md:text-4xl">
          {regionName}
        </h1>
        <p className="mt-2 text-muted-foreground">{dict.vignoble.subregions}</p>
      </div>

      {subregions.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          {dict.common.empty}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {subregions.map((sub) => (
            <SubregionCard
              key={sub.id}
              subregion={sub}
              regionSlug={regionSlug}
              locale={locale}
              hectaresLabel={dict.vignoble.hectares}
            />
          ))}
        </div>
      )}
    </div>
  );
}
