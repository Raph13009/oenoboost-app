"use client";

import type { SubregionLegendItem } from "@/components/map/types";

type SubregionLegendProps = {
  items: SubregionLegendItem[];
  onPick: (subregionId: string) => void;
};

export function SubregionLegend({ items, onPick }: SubregionLegendProps) {
  return (
    <div className="h-full rounded-xl border border-border bg-card p-3">
      <div className="grid h-full grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onPick(item.id)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
          >
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: item.colorHex }}
            />
            <span className="truncate">{item.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
