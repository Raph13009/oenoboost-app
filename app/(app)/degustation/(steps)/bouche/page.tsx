import { DegustationOnboardingStep } from "@/features/degustation/components/degustation-onboarding-step";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { getServerLocale } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/auth/session";

export async function generateMetadata() {
  const locale = await getServerLocale();
  const dict = await getDictionary(locale);
  return {
    title: `${dict.degustation.step3Title} — ${dict.degustation.title} — OenoBoost`,
  };
}

export default async function DegustationBouchePage() {
  const dict = await getDictionary(await getServerLocale());
  const d = dict.degustation;
  const user = await getCurrentUser();
  const startPath = "/degustation/oeil/start";

  return (
    <DegustationOnboardingStep
      step={3}
      imageSrc="/mouth.svg"
      imageWidth={120}
      imageHeight={80}
      imageClassName="h-14 w-auto object-contain sm:h-24 md:h-28"
      title={d.step3Title}
      body={d.step3Body}
      nextHref="/degustation/oeil/start"
      prevHref="/degustation/nez"
      isLastStep
      labels={d}
      authGate={
        user
          ? null
          : {
              nextPath: startPath,
              copy: {
                title: d.authModalTitle,
                body: d.authModalBody,
                login: dict.auth.login,
                register: dict.auth.registerButton,
              },
            }
      }
    />
  );
}
