"use client";

import { forwardRef } from "react";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  VignobleMapLocale,
  VignobleMapRegion,
  VignobleMapStrings,
} from "@/components/map/types";

type RegionDetailCardProps = {
  region: VignobleMapRegion | null;
  locale: VignobleMapLocale;
  strings: VignobleMapStrings;
  discoverDisabled: boolean;
  onClose: () => void;
  onDiscover: () => void;
};

export const RegionDetailCard = forwardRef<HTMLDivElement, RegionDetailCardProps>(
  function RegionDetailCard(
    { region, locale, strings, discoverDisabled, onClose, onDiscover },
    ref,
  ) {
    return (
      <div
        ref={ref}
        className="absolute bottom-0 left-0 right-0 z-20 rounded-t-lg border-t border-border bg-background"
      >
        <div className="flex items-start justify-between gap-3 p-2 pb-1.5 md:p-4 md:pb-3">
          <div className="min-w-0">
            <div className="font-heading text-lg text-wine md:text-xl">
              {region?.name ?? ""}
            </div>
            {!region && (
              <div className="mt-2 text-sm text-muted-foreground">
                {strings.na}
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label={strings.closeLabel}
            className="shrink-0"
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>

        {region && (
          <div className="px-2 pb-2 pt-0 md:px-4 md:pb-4">
            <div className="mt-0 grid grid-cols-2 gap-1.5 md:gap-3">
              <div className="rounded-xl border border-border bg-card p-2 md:p-3">
                <div className="text-xs text-muted-foreground">
                  {strings.departmentsLabel}
                </div>
                <div className="mt-1 font-heading text-base md:text-lg">
                  {region.department_count === null
                    ? strings.na
                    : new Intl.NumberFormat(locale).format(
                        region.department_count,
                      )}
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-2 md:p-3">
                <div className="text-xs text-muted-foreground">
                  {strings.hectaresLabel}
                </div>
                <div className="mt-1 font-heading text-base md:text-lg">
                  {region.area_hectares === null
                    ? strings.na
                    : new Intl.NumberFormat(locale).format(
                        region.area_hectares,
                      )}
                </div>
              </div>

              <div className="col-span-2 rounded-xl border border-border bg-card p-2 md:p-3">
                <div className="text-xs text-muted-foreground">
                  {strings.totalProductionLabel}
                </div>
                <div className="mt-1 font-heading text-base md:text-lg">
                  {region.total_production_hl === null
                    ? strings.na
                    : `${new Intl.NumberFormat(locale).format(
                        region.total_production_hl,
                      )} hl`}
                </div>
              </div>
            </div>

            <div className="mt-2 flex gap-2 md:mt-4">
              <Button
                className="h-11 flex-1"
                disabled={discoverDisabled}
                onClick={onDiscover}
              >
                {strings.discover}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  },
);
