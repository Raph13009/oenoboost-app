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
          className="relative inline-flex h-8 w-44 items-center rounded-full border bg-background/90 backdrop-blur-sm shadow-sm disabled:opacity-60 sm:h-9 sm:w-60"
        >
          <span
            className={`absolute bottom-0.5 top-0.5 w-[calc(50%-4px)] rounded-full bg-wine transition-[left] duration-200 ease-out ${
              isSub ? "left-1" : "left-[calc(50%+3px)]"
            }`}
          />
          <span className="relative z-10 inline-flex w-1/2 items-center justify-center px-2 text-xs font-medium sm:px-3 sm:text-sm">
            <span
              className={`whitespace-nowrap ${isSub ? "text-white" : "text-foreground"}`}
            >
              {subregionsLabel}
            </span>
          </span>
          <span className="relative z-10 inline-flex w-1/2 items-center justify-center px-2 text-xs font-medium sm:px-3 sm:text-sm">
            <span className={isSub ? "text-foreground" : "text-white"}>
              {aopLabel}
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
