"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getContent } from "@/lib/i18n/get-content";
import type { Locale } from "@/lib/i18n/config";
import type { Grape } from "../types";
import type { GrapeFavoriteLabels } from "./grape-favorite-button";
import { GrapeFavoriteButton } from "./grape-favorite-button";

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
  };
  favoriteList: {
    favoritedIds: string[];
    isLoggedIn: boolean;
    favoriteLabels: GrapeFavoriteLabels;
  };
};

export function GrapesList({
  grapes,
  locale,
  labels,
  favoriteList,
}: GrapesListProps) {
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("");

  const favoritedSet = useMemo(
    () => new Set(favoriteList.favoritedIds),
    [favoriteList.favoritedIds],
  );

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
            <div
              key={grape.id}
              className="flex items-stretch overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-wine/20"
            >
              <Link
                href={`/cepages/${grape.slug}`}
                className="min-w-0 flex-1 p-4 transition-colors"
              >
                <h2 className="font-heading text-xl">
                  {getContent(grape, "name", locale)}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {shortText(
                    locale === "fr"
                      ? grape.production_regions_fr
                      : grape.production_regions_en,
                  )}
                </p>
              </Link>
              <div className="flex shrink-0 items-center border-l border-border/50 px-2">
                <GrapeFavoriteButton
                  grapeId={grape.id}
                  grapeSlug={grape.slug}
                  initialFavorited={favoritedSet.has(grape.id)}
                  isLoggedIn={favoriteList.isLoggedIn}
                  labels={favoriteList.favoriteLabels}
                  size="sm"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
