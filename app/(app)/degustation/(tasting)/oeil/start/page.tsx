import { EyeTastingClient } from "@/features/degustation/components/tasting/eye-tasting-client";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getServerLocale } from "@/lib/i18n/server";

export async function generateMetadata() {
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);
  return {
    title: `${dict.tastingFlow.stepEye} — OenoBoost`,
  };
}

export default async function TastingEyeStartPage() {
  const dict = await getDictionary(await getServerLocale());
  return <EyeTastingClient labels={dict.tastingFlow} />;
}
