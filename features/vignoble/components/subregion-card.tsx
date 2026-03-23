import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { WineSubregion } from "../types";
import type { Locale } from "@/lib/i18n/config";
import { getContent } from "@/lib/i18n/get-content";

type SubregionCardProps = {
  subregion: WineSubregion;
  regionSlug: string;
  locale: Locale;
  hectaresLabel: string;
};

export function SubregionCard({
  subregion,
  regionSlug,
  locale,
  hectaresLabel,
}: SubregionCardProps) {
  const name = getContent(subregion, "name", locale);
  const description = getContent(subregion, "description", locale);

  return (
    <Link href={`/vignoble/${regionSlug}/${subregion.slug}`}>
      <div className="group flex items-center justify-between rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-wine/20 hover:shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-lg font-semibold">{name}</h2>
          {description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {description}
            </p>
          )}
          {subregion.area_hectares && (
            <p className="text-xs text-muted-foreground">
              {subregion.area_hectares.toLocaleString(locale)} {hectaresLabel}
            </p>
          )}
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-wine" />
      </div>
    </Link>
  );
}
