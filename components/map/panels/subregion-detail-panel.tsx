"use client";

import { Button } from "@/components/ui/button";
import type {
  SubregionLegendItem,
  VignobleMapLocale,
  VignobleMapStrings,
} from "@/components/map/types";

type SubregionDetailPanelProps = {
  subregion: SubregionLegendItem;
  locale: VignobleMapLocale;
  strings: VignobleMapStrings;
  onBack: () => void;
};

export function SubregionDetailPanel({
  subregion,
  locale,
  strings,
  onBack,
}: SubregionDetailPanelProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="font-heading text-lg text-wine">{subregion.name}</div>
        <Button type="button" size="sm" variant="outline" onClick={onBack}>
          {strings.backToRegion}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-card p-3">
        <div className="text-xs text-muted-foreground">
          {strings.hectaresLabel}
        </div>
        <div className="text-sm">
          {subregion.areaHectares === null
            ? strings.na
            : new Intl.NumberFormat(locale).format(subregion.areaHectares)}
        </div>
        <div className="mt-3 text-xs text-muted-foreground">Description</div>
        <div className="text-sm">{subregion.description || strings.na}</div>
      </div>
    </div>
  );
}
