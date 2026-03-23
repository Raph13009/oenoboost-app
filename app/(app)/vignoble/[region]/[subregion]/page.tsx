import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getRegionBySlug } from "@/features/vignoble/queries/regions.queries";
import { getSubregionBySlug } from "@/features/vignoble/queries/subregions.queries";
import { getAppellations } from "@/features/vignoble/queries/appellations.queries";
import { AppellationCard } from "@/features/vignoble/components/appellation-card";
import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getContent } from "@/lib/i18n/get-content";

type Props = {
  params: Promise<{ region: string; subregion: string }>;
};

export default async function SubregionPage({ params }: Props) {
  const { region: regionSlug, subregion: subregionSlug } = await params;
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);

  const region = await getRegionBySlug(regionSlug);
  if (!region) notFound();

  const subregion = await getSubregionBySlug(subregionSlug);
  if (!subregion) notFound();

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
              subregionSlug={subregionSlug}
              locale={locale}
            />
          ))}
        </div>
      )}
    </div>
  );
}
