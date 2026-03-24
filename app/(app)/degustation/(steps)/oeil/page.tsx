import { DegustationOnboardingStep } from "@/features/degustation/components/degustation-onboarding-step";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getServerLocale } from "@/lib/i18n/server";

export async function generateMetadata() {
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);
  return {
    title: `${dict.degustation.step1Title} — ${dict.degustation.title} — OenoBoost`,
  };
}

export default async function DegustationOeilPage() {
  const dict = await getDictionary(await getServerLocale());
  const d = dict.degustation;

  return (
    <DegustationOnboardingStep
      step={1}
      imageSrc="/eye.svg"
      imageWidth={120}
      imageHeight={80}
      imageClassName="h-14 w-auto object-contain sm:h-24 md:h-28"
      title={d.step1Title}
      body={d.step1Body}
      nextHref="/degustation/nez"
      prevHref={null}
      isLastStep={false}
      labels={d}
    />
  );
}
