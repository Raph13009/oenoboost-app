"use client";

import { Button } from "@/components/ui/button";

export type MapLayerMode = "subregions" | "aop";

type MapActionBarProps = {
  backLabel: string;
  subregionsLabel: string;
  aopLabel: string;
  layerMode: MapLayerMode;
  aopLoading: boolean;
  toggleDisabled?: boolean;
  onBack: () => void;
  onLayerModeChange: (mode: MapLayerMode) => void;
};

export function MapActionBar({
  backLabel,
  subregionsLabel,
  aopLabel,
  layerMode,
  aopLoading,
  toggleDisabled = false,
  onBack,
  onLayerModeChange,
}: MapActionBarProps) {
  const isSub = layerMode === "subregions";
  const activeLabel = isSub ? subregionsLabel : aopLabel;
  return (
    <div className="absolute left-3 top-3 z-20 flex items-center gap-2">
      <Button
        variant="outline"
        className="bg-background/90 backdrop-blur-sm"
        onClick={onBack}
      >
        {backLabel}
      </Button>
      {!toggleDisabled && (
        <button
          type="button"
          role="switch"
          aria-checked={!isSub}
          aria-label={`${subregionsLabel} / ${aopLabel}`}
          disabled={aopLoading}
          onClick={() => onLayerModeChange(isSub ? "aop" : "subregions")}
          className="relative inline-flex h-9 w-60 items-center rounded-full border bg-background/90 backdrop-blur-sm shadow-sm disabled:opacity-60"
        >
          <span
            className={`absolute top-0.5 bottom-0.5 w-[calc(50%-4px)] flex items-center justify-center rounded-full bg-wine px-3 text-sm font-medium text-white transition-[left] duration-200 ease-out ${
              isSub ? "left-1" : "left-[calc(50%+3px)]"
            }`}
          >
            {activeLabel}
          </span>
        </button>
      )}
    </div>
  );
}
