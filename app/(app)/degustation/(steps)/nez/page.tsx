import { DegustationOnboardingStep } from "@/features/degustation/components/degustation-onboarding-step";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getServerLocale } from "@/lib/i18n/server";

export async function generateMetadata() {
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);
  return {
    title: `${dict.degustation.step2Title} — ${dict.degustation.title} — OenoBoost`,
  };
}

export default async function DegustationNezPage() {
  const dict = await getDictionary(await getServerLocale());
  const d = dict.degustation;

  return (
    <DegustationOnboardingStep
      step={2}
      imageSrc="/nose.svg"
      imageWidth={80}
      imageHeight={120}
      imageClassName="h-16 w-auto scale-[1.06] object-contain sm:h-28 sm:scale-105 md:h-[8.5rem] md:scale-100"
      title={d.step2Title}
      body={d.step2Body}
      nextHref="/degustation/bouche"
      prevHref="/degustation/oeil"
      isLastStep={false}
      labels={d}
    />
  );
}
