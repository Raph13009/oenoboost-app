"use client";

import Link from "next/link";
import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  VignobleMapLocale,
  VignobleMapStrings,
} from "@/components/map/types";

export type AopPanelInfo = {
  id: number;
  slug: string | null;
  name: string;
  area_hectares: number | null;
  colors_grapes_fr: string | null;
  colors_grapes_en: string | null;
  is_grand_cru: boolean;
  region_slug: string | null;
};

type AopDetailPanelProps = {
  aop: AopPanelInfo;
  loading: boolean;
  locale: VignobleMapLocale;
  strings: VignobleMapStrings;
  onBack: () => void;
};

export function AopDetailPanel({
  aop,
  loading,
  locale,
  strings,
  onBack,
}: AopDetailPanelProps) {
  const grapes = locale === "en" ? aop.colors_grapes_en : aop.colors_grapes_fr;
  const detailHref =
    aop.region_slug && aop.slug
      ? `/vignoble/${aop.region_slug}/${aop.slug}`
      : null;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex flex-col gap-1">
          <div className="font-heading text-lg text-wine">{aop.name}</div>
          {aop.is_grand_cru && (
            <span className="inline-flex w-fit items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
              Grand Cru
            </span>
          )}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onBack}>
          {strings.backToRegion}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-card p-3">
        <div className="text-xs text-muted-foreground">
          {strings.hectaresLabel}
        </div>
        <div className="text-sm">
          {aop.area_hectares === null
            ? loading
              ? strings.loading
              : strings.na
            : new Intl.NumberFormat(locale).format(aop.area_hectares)}
        </div>

        <div className="mt-3 text-xs text-muted-foreground">
          {strings.grapesLabel}
        </div>
        <div className="text-sm whitespace-pre-line">
          {grapes ? grapes : loading ? strings.loading : strings.na}
        </div>

        {detailHref ? (
          <div className="mt-4">
            <Link
              href={detailHref}
              className="inline-flex h-9 items-center justify-center rounded-lg bg-wine px-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              {strings.openAopDetail}
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
