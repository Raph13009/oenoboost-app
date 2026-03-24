import Link from "next/link";

import { computeTastingMood } from "@/features/degustation/utils/tasting-mood";
import { getHexForEyeColorId } from "@/features/degustation/tasting/wine-colors";
import type { TastingSheetListRow } from "@/features/degustation/queries/tasting-sheets.queries";
import type { Dictionary } from "@/lib/i18n/dictionaries/fr";
import { cn } from "@/lib/utils";

import { formatTastingMonthYear } from "@/features/degustation/utils/tasting-date";
import type { Locale } from "@/lib/i18n/config";

type Props = {
  row: TastingSheetListRow;
  h: Dictionary["tastingHistory"];
  locale: Locale;
};

function moodLabel(
  key: ReturnType<typeof computeTastingMood>,
  h: Dictionary["tastingHistory"],
) {
  if (key === "fresh") return h.moodFresh;
  if (key === "powerful") return h.moodPowerful;
  return h.moodBalanced;
}

export function TastingHistoryCard({ row, h, locale }: Props) {
  const title = row.wine_name?.trim() || h.untitledWine;
  const mood = computeTastingMood(row);
  const hex = getHexForEyeColorId(row.eye_color);
  const when = formatTastingMonthYear(row.created_at, locale);

  return (
    <Link
      href={`/degustation/history/${row.id}`}
      className={cn(
        "block rounded-2xl border border-border/50 bg-card p-4 shadow-sm transition-transform duration-200 ease-out",
        "active:scale-[0.98] hover:border-wine/20 hover:shadow-md dark:bg-card/80",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="font-heading text-lg font-semibold leading-tight text-foreground">
            {title}
          </div>
          {row.vintage != null ? (
            <p className="text-sm text-muted-foreground">{row.vintage}</p>
          ) : null}
          <p className="text-xs text-muted-foreground capitalize">{when}</p>
          <p className="mt-2 inline-flex w-fit rounded-full border border-wine/15 bg-wine/5 px-2.5 py-0.5 text-[11px] font-medium text-wine">
            {moodLabel(mood, h)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span
            className="h-10 w-10 rounded-full border border-border/40 shadow-inner ring-2 ring-background"
            style={{ backgroundColor: hex }}
            aria-hidden
          />
          <span className="h-1 w-12 rounded-full bg-gradient-to-r from-transparent via-wine/30 to-wine/50" />
        </div>
      </div>
    </Link>
  );
}
