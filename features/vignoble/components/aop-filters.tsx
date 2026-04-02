"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { getSubregionOptionsByRegionId } from "../queries/get-subregion-options-by-region-id";

type RegionOption = {
  id: string;
  name_fr: string;
  name_en: string;
};

type SubregionOption = {
  id: string;
  region_id: string;
  name_fr: string;
  name_en: string;
};

type AopFiltersProps = {
  locale: "fr" | "en";
  regionLabel: string;
  subregionLabel: string;
  selectedRegionId?: string;
  selectedSubregionId?: string;
  regions: RegionOption[];
  initialSubregions: SubregionOption[];
};

export function AopFilters({
  locale,
  regionLabel,
  subregionLabel,
  selectedRegionId = "",
  selectedSubregionId = "",
  regions,
  initialSubregions,
}: AopFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [regionId, setRegionId] = useState(selectedRegionId);
  const [subregionId, setSubregionId] = useState(selectedSubregionId);
  const [subregionOptions, setSubregionOptions] =
    useState<SubregionOption[]>(initialSubregions);

  const displayedSubregions = useMemo(() => {
    if (!regionId) return [];
    return subregionOptions;
  }, [regionId, subregionOptions]);

  const pushFilters = (nextRegionId: string, nextSubregionId: string) => {
    const params = new URLSearchParams();
    if (nextRegionId) params.set("region", nextRegionId);
    if (nextSubregionId) params.set("subregion", nextSubregionId);

    startTransition(() => {
      router.replace(
        params.toString() ? `${pathname}?${params.toString()}` : pathname,
        { scroll: false },
      );
    });
  };

  const onRegionChange = async (value: string) => {
    setRegionId(value);
    setSubregionId("");

    if (!value) {
      setSubregionOptions([]);
      pushFilters("", "");
      return;
    }

    const options = await getSubregionOptionsByRegionId(value);
    setSubregionOptions(options);
    pushFilters(value, "");
  };

  const onSubregionChange = (value: string) => {
    setSubregionId(value);
    pushFilters(regionId, value);
  };

  return (
    <div
      className={`grid grid-cols-1 gap-3 transition-opacity md:grid-cols-2 ${isPending ? "opacity-70" : "opacity-100"}`}
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {regionLabel}
        </span>
        <div className="relative">
          <select
            name="region"
            value={regionId}
            onChange={(e) => void onRegionChange(e.target.value)}
            className="h-12 w-full appearance-none rounded-xl border border-border bg-card px-4 pr-11 text-base font-medium text-foreground shadow-sm outline-none transition-colors focus:border-wine/40 focus:ring-2 focus:ring-wine/10"
          >
            <option value="" className="text-base">
              {regionLabel}
            </option>
            {regions.map((region) => (
              <option key={region.id} value={region.id} className="text-base">
                {locale === "fr" ? region.name_fr : region.name_en}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {subregionLabel}
        </span>
        <div className="relative">
          <select
            name="subregion"
            value={subregionId}
            onChange={(e) => onSubregionChange(e.target.value)}
            disabled={!regionId}
            className="h-12 w-full appearance-none rounded-xl border border-border bg-card px-4 pr-11 text-base font-medium text-foreground shadow-sm outline-none transition-colors focus:border-wine/40 focus:ring-2 focus:ring-wine/10 disabled:cursor-not-allowed disabled:bg-muted/30 disabled:text-muted-foreground disabled:opacity-100"
          >
            <option value="" className="text-base">
              {subregionLabel}
            </option>
            {displayedSubregions.map((sub) => (
              <option key={sub.id} value={sub.id} className="text-base">
                {locale === "fr" ? sub.name_fr : sub.name_en}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      </label>
    </div>
  );
}
