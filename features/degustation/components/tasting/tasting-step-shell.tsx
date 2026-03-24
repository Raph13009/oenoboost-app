"use client";

import { TASTING_SHELL_CLASS } from "@/features/degustation/constants";
import { cn } from "@/lib/utils";

type Props = {
  step: 1 | 2 | 3;
  title: string;
  /** true = zone centrale scrollable (nez / bouche) */
  scrollContent?: boolean;
  children: React.ReactNode;
  footer: React.ReactNode;
};

export function TastingStepShell({
  step,
  title,
  scrollContent = false,
  children,
  footer,
}: Props) {
  const pct = (step / 3) * 100;

  return (
    <div className={TASTING_SHELL_CLASS}>
      <div className="shrink-0 space-y-2 px-4 pt-1">
        <p className="text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">
          {title}
        </p>
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted sm:h-1.5">
          <div
            className="h-full rounded-full bg-wine transition-[width] duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <div
        className={cn(
          "min-h-0 flex-1 px-4",
          scrollContent ? "overflow-y-auto overflow-x-hidden pb-2" : "overflow-hidden",
        )}
      >
        {children}
      </div>
      <div className="shrink-0 border-t border-border/40 bg-background/95 backdrop-blur-md supports-backdrop-filter:bg-background/90">
        {footer}
      </div>
    </div>
  );
}
