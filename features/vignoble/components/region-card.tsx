import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { WineRegion } from "../types";
import type { Locale } from "@/lib/i18n/config";
import { getContent } from "@/lib/i18n/get-content";

type RegionCardProps = {
  region: WineRegion;
  locale: Locale;
  hectaresLabel: string;
};

export function RegionCard({ region, locale, hectaresLabel }: RegionCardProps) {
  const name = getContent(region, "name", locale);

  return (
    <Link href={`/vignoble/${region.slug}`}>
      <div className="group flex items-center justify-between rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-wine/20 hover:shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-lg font-semibold">{name}</h2>
          {region.area_hectares && (
            <p className="text-sm text-muted-foreground">
              {region.area_hectares.toLocaleString(locale)} {hectaresLabel}
            </p>
          )}
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-wine" />
      </div>
    </Link>
  );
}
