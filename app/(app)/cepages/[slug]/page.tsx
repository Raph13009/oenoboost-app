import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getGrapeBySlug } from "@/features/cepages/queries/grapes.queries";
import { GrapeDetail } from "@/features/cepages/components/grape-detail";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function GrapeDetailPage({ params }: Props) {
  const { slug } = await params;
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);
  const grape = await getGrapeBySlug(slug);

  if (!grape) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/cepages"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-wine"
      >
        <ArrowLeft className="h-4 w-4" />
        {dict.cepages.backToGrapes}
      </Link>

      <GrapeDetail
        grape={grape}
        locale={locale}
        labels={{
          origin: dict.cepages.origin,
          history: dict.cepages.history,
          characteristics: dict.cepages.characteristics,
          tasting: dict.cepages.tasting,
          productionRegions: dict.cepages.productionRegions,
          crossings: dict.cepages.crossings,
          emblematicWines: dict.cepages.emblematicWines,
          grapeMap: dict.cepages.grapeMap,
          mapPlaceholder: dict.cepages.mapPlaceholder,
          red: dict.cepages.red,
          white: dict.cepages.white,
          rose: dict.cepages.rose,
        }}
      />
    </div>
  );
}
