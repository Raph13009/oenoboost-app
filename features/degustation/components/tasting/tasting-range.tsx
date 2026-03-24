"use client";

import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  hint?: string;
  className?: string;
};

export function TastingRange({
  label,
  value,
  onChange,
  min = 1,
  max = 10,
  hint,
  className,
}: Props) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-foreground sm:text-sm">{label}</span>
        <span className="tabular-nums text-sm font-semibold text-wine">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer accent-[#7C2736] dark:accent-[#a8485c]"
      />
      {hint ? (
        <p className="text-[10px] leading-snug text-muted-foreground sm:text-xs">{hint}</p>
      ) : null}
    </div>
  );
}
