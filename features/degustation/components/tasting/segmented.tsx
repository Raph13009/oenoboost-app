"use client";

import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

type Props = {
  options: Option[];
  value: string | null;
  onChange: (v: string) => void;
  className?: string;
};

export function SegmentedRow({ options, value, onChange, className }: Props) {
  return (
    <div
      className={cn(
        "grid gap-2",
        options.length === 3 && "grid-cols-3",
        options.length === 2 && "grid-cols-2",
        options.length > 3 && "grid-cols-2 sm:grid-cols-4",
        className,
      )}
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-11 rounded-xl border px-2 py-2.5 text-center text-xs font-medium transition-all active:scale-[0.98] sm:min-h-12 sm:text-sm",
              active
                ? "border-wine bg-wine/10 text-wine shadow-[0_0_0_1px_rgba(124,39,54,0.25)]"
                : "border-border/60 bg-card/50 text-foreground hover:border-wine/30 dark:bg-card/40",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
