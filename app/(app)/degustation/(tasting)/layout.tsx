import { TastingFlowProvider } from "@/features/degustation/tasting/tasting-flow-context";

export default function TastingExperienceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TastingFlowProvider>{children}</TastingFlowProvider>;
}
