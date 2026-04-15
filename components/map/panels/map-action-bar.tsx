"use client";

import { Button } from "@/components/ui/button";

type MapActionBarProps = {
  backLabel: string;
  aopVisible: boolean;
  aopLoading: boolean;
  onBack: () => void;
  onToggleAop: () => void;
};

export function MapActionBar({
  backLabel,
  aopVisible,
  aopLoading,
  onBack,
  onToggleAop,
}: MapActionBarProps) {
  return (
    <div className="absolute left-3 top-3 z-20 flex items-center gap-2">
      <Button
        variant="outline"
        className="bg-background/90 backdrop-blur-sm"
        onClick={onBack}
      >
        {backLabel}
      </Button>
      <Button
        variant="outline"
        className={
          aopVisible
            ? "border-wine bg-wine text-white hover:bg-wine/90 hover:text-white"
            : "bg-background/90 text-foreground backdrop-blur-sm"
        }
        disabled={aopLoading}
        onClick={onToggleAop}
      >
        AOP
      </Button>
    </div>
  );
}
