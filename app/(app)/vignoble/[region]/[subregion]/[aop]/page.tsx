import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAppellationBySlug } from "@/features/vignoble/queries/appellations.queries";
import { AppellationDetail } from "@/features/vignoble/components/appellation-detail";
import { getServerLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";

type Props = {
  params: Promise<{ region: string; subregion: string; aop: string }>;
};

export default async function AppellationPage({ params }: Props) {
  const {
    region: regionSlug,
    subregion: subregionSlug,
    aop: aopSlug,
  } = await params;
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);

  const appellation = await getAppellationBySlug(aopSlug);
  if (!appellation) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/vignoble/${regionSlug}/${subregionSlug}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-wine"
      >
        <ArrowLeft className="h-4 w-4" />
        {dict.vignoble.backToAppellations}
      </Link>

      <AppellationDetail appellation={appellation} locale={locale} />
    </div>
  );
}
