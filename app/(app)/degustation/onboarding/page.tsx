import { redirect } from "next/navigation";

/** Ancienne URL : redirige vers le premier écran d’onboarding. */
export default function DegustationOnboardingRedirectPage() {
  redirect("/degustation/oeil");
}
