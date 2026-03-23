"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
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
    <div className={`flex flex-col gap-3 transition-opacity ${isPending ? "opacity-70" : "opacity-100"}`}>
      <select
        name="region"
        value={regionId}
        onChange={(e) => void onRegionChange(e.target.value)}
        className="rounded-md border border-border bg-background px-3 py-2 text-sm"
      >
        <option value="">{regionLabel}</option>
        {regions.map((region) => (
          <option key={region.id} value={region.id}>
            {locale === "fr" ? region.name_fr : region.name_en}
          </option>
        ))}
      </select>

      <select
        name="subregion"
        value={subregionId}
        onChange={(e) => onSubregionChange(e.target.value)}
        disabled={!regionId}
        className="rounded-md border border-border bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">{subregionLabel}</option>
        {displayedSubregions.map((sub) => (
          <option key={sub.id} value={sub.id}>
            {locale === "fr" ? sub.name_fr : sub.name_en}
          </option>
        ))}
      </select>
    </div>
  );
}
