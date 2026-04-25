"use client";

import type { SubregionLegendItem } from "@/components/map/types";

type SubregionLegendProps = {
  items: SubregionLegendItem[];
  onPick: (subregionId: string) => void;
};

export function SubregionLegend({ items, onPick }: SubregionLegendProps) {
  const density =
    items.length <= 4 ? "few" : items.length <= 8 ? "medium" : "many";

  const desktopLayoutClass =
    density === "few"
      ? "md:flex md:flex-wrap md:items-center md:justify-center md:gap-2"
      : density === "medium"
        ? "md:flex md:flex-wrap md:items-center md:justify-start md:gap-2"
        : "md:grid md:grid-cols-2 md:gap-x-2 md:gap-y-1.5 lg:grid-cols-3 xl:grid-cols-4";

  return (
    <div className="h-full rounded-xl border border-border bg-card p-3 md:inline-flex md:h-auto md:w-fit md:max-w-[min(92vw,72rem)] md:max-h-[220px] md:border-border/60 md:bg-card/95 md:p-2.5 md:shadow-sm md:backdrop-blur-[2px]">
      <div
        className={[
          "grid h-full grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2",
          "md:h-auto md:max-h-[200px] md:grid-cols-1 md:gap-1.5 md:overflow-y-auto md:pr-0",
          desktopLayoutClass,
        ].join(" ")}
      >
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onPick(item.id)}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted md:gap-2.5 md:rounded-lg md:border md:border-transparent md:bg-muted/40 md:px-2.5 md:py-1.5 md:text-[13px] md:font-medium md:leading-5 md:hover:border-border/60 md:hover:bg-muted/70"
          >
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full md:h-3 md:w-3"
              style={{ backgroundColor: item.colorHex }}
            />
            <span className="truncate">{item.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
