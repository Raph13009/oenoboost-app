import { NoseTastingClient } from "@/features/degustation/components/tasting/nose-tasting-client";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getServerLocale } from "@/lib/i18n/server";

export async function generateMetadata() {
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);
  return {
    title: `${dict.tastingFlow.stepNose} — OenoBoost`,
  };
}

export default async function TastingNoseStartPage() {
  const dict = await getDictionary(await getServerLocale());
  return <NoseTastingClient labels={dict.tastingFlow} />;
}
