import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type GrapeDetailSectionProps = {
  title: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

/**
 * Shared card chrome for grape detail (title + content).
 * Matches grid card spacing and borders across the page.
 */
export function GrapeDetailSection({
  title,
  children,
  className,
  contentClassName,
}: GrapeDetailSectionProps) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-xl border border-border bg-card p-4 md:p-5",
        className,
      )}
    >
      <h2 className="font-heading text-xl font-semibold">{title}</h2>
      <div className={cn("mt-3", contentClassName)}>{children}</div>
    </section>
  );
}
