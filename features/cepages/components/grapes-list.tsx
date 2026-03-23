"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getContent } from "@/lib/i18n/get-content";
import type { Locale } from "@/lib/i18n/config";
import type { Grape } from "../types";

function extractRegionTokens(input: string | null) {
  if (!input) return [];
  return input
    .split(/[,;/|]/g)
    .map((r) => r.trim())
    .filter(Boolean);
}

function shortText(input: string | null, max = 80) {
  if (!input) return "...";
  if (input.length <= max) return input;
  return `${input.slice(0, max).trim()}...`;
}

type GrapesListProps = {
  grapes: Grape[];
  locale: Locale;
  labels: {
    searchPlaceholder: string;
    allRegions: string;
    red: string;
    white: string;
    rose: string;
  };
};

export function GrapesList({ grapes, locale, labels }: GrapesListProps) {
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("");

  const regionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const grape of grapes) {
      const regions = extractRegionTokens(
        locale === "fr" ? grape.production_regions_fr : grape.production_regions_en,
      );
      for (const r of regions) set.add(r);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [grapes, locale]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return grapes.filter((grape) => {
      const nameFr = grape.name_fr.toLowerCase();
      const nameEn = grape.name_en.toLowerCase();
      const textRegion = (
        locale === "fr" ? grape.production_regions_fr : grape.production_regions_en
      )?.toLowerCase();

      const matchesSearch = !q || nameFr.includes(q) || nameEn.includes(q);
      const matchesRegion =
        !region || (textRegion ? textRegion.includes(region.toLowerCase()) : false);

      return matchesSearch && matchesRegion;
    });
  }, [grapes, locale, region, search]);

  const typeLabel = (type: Grape["type"]) => {
    if (type === "red") return labels.red;
    if (type === "white") return labels.white;
    return labels.rose;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={labels.searchPlaceholder}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <select
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">{labels.allRegions}</option>
          {regionOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">...</p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((grape) => (
            <Link
              key={grape.id}
              href={`/cepages/${grape.slug}`}
              className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-wine/20"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-heading text-xl">
                  {getContent(grape, "name", locale)}
                </h2>
                <span className="rounded-full border border-border px-2 py-1 text-xs text-muted-foreground">
                  {typeLabel(grape.type)}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {shortText(
                  locale === "fr"
                    ? grape.production_regions_fr
                    : grape.production_regions_en,
                )}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
