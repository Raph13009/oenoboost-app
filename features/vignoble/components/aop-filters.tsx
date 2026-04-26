"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

type RegionOption = {
  id: string;
  name_fr: string;
  name_en: string;
};

type AopFiltersProps = {
  locale: "fr" | "en";
  regionLabel: string;
  selectedRegionId?: string;
  regions: RegionOption[];
};

export function AopFilters({
  locale,
  regionLabel,
  selectedRegionId = "",
  regions,
}: AopFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [regionId, setRegionId] = useState(selectedRegionId);

  const onRegionChange = (value: string) => {
    setRegionId(value);
    const params = new URLSearchParams();
    if (value) params.set("region", value);
    startTransition(() => {
      router.replace(
        params.toString() ? `${pathname}?${params.toString()}` : pathname,
        { scroll: false },
      );
    });
  };

  return (
    <div
      className={`transition-opacity ${isPending ? "opacity-70" : "opacity-100"}`}
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {regionLabel}
        </span>
        <div className="relative">
          <select
            name="region"
            value={regionId}
            onChange={(e) => onRegionChange(e.target.value)}
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
    </div>
  );
}
