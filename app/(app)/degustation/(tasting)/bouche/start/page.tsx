import { MouthTastingClient } from "@/features/degustation/components/tasting/mouth-tasting-client";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getServerLocale } from "@/lib/i18n/server";

export async function generateMetadata() {
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);
  return {
    title: `${dict.tastingFlow.stepMouth} — OenoBoost`,
  };
}

export default async function TastingMouthStartPage() {
  const dict = await getDictionary(await getServerLocale());
  return (
    <MouthTastingClient
      labels={dict.tastingFlow}
      loginLabel={dict.auth.loginButton}
    />
  );
}
