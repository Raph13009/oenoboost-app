/** Conteneur flex pour le module ; le verrouillage du scroll est géré par le sous-layout onboarding uniquement. */
export default function DegustationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">{children}</div>
  );
}
