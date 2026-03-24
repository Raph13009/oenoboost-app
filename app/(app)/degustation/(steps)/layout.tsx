import { DegustationScrollLock } from "@/features/degustation/components/degustation-scroll-lock";

/** Onboarding œil / nez / bouche : plein écran sans scroll dans <main>. */
export default function DegustationOnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <DegustationScrollLock />
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </>
  );
}
