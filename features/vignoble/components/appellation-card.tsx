import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Appellation } from "../types";
import type { Locale } from "@/lib/i18n/config";
import { getContent } from "@/lib/i18n/get-content";

type AppellationCardProps = {
  appellation: Appellation;
  regionSlug: string;
  subregionSlug: string;
  locale: Locale;
};

export function AppellationCard({
  appellation,
  regionSlug,
  subregionSlug,
  locale,
}: AppellationCardProps) {
  const name = getContent(appellation, "name", locale);

  return (
    <Link
      href={`/vignoble/${regionSlug}/${subregionSlug}/${appellation.slug}`}
    >
      <div className="group flex items-center justify-between rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-wine/20 hover:shadow-sm">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-base font-semibold">{name}</h2>
          {appellation.area_hectares && (
            <p className="text-xs text-muted-foreground">
              {Number(appellation.area_hectares).toLocaleString(locale)} ha
            </p>
          )}
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-wine" />
      </div>
    </Link>
  );
}
