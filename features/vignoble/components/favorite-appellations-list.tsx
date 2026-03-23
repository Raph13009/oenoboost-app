"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MapPin, X } from "lucide-react";

import { toggleAppellationFavoriteAction } from "@/features/vignoble/actions/appellation-favorite-actions";
import type { FavoriteAppellationRow } from "@/features/vignoble/queries/aop-favorites.queries";
import { getContent } from "@/lib/i18n/get-content";
import type { Locale } from "@/lib/i18n/config";
import { Button } from "@/components/ui/button";

type Labels = {
  removeAria: string;
};

type Props = {
  initialItems: FavoriteAppellationRow[];
  locale: Locale;
  labels: Labels;
};

export function FavoriteAppellationsList({
  initialItems,
  locale,
  labels,
}: Props) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const remove = (row: FavoriteAppellationRow) => {
    setPendingId(row.favoriteId);
    startTransition(async () => {
      await toggleAppellationFavoriteAction(
        row.appellation.id,
        row.regionSlug,
        row.appellation.slug,
        row.subregionSlug,
      );
      setPendingId(null);
      router.refresh();
    });
  };

  return (
    <ul className="flex flex-col gap-3">
      {initialItems.map((row) => {
        const name = getContent(row.appellation, "name", locale);
        const href = `/vignoble/${row.regionSlug}/${row.appellation.slug}?subregion=${encodeURIComponent(row.subregionSlug)}&from=favorites`;
        return (
          <li
            key={row.favoriteId}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/20"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background text-wine">
              <MapPin className="h-4 w-4" aria-hidden />
            </div>
            <Link
              href={href}
              className="min-w-0 flex-1 font-medium text-foreground transition-colors hover:text-wine"
            >
              <span className="block truncate">{name}</span>
              <span className="text-xs font-normal text-muted-foreground">
                AOP
              </span>
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-muted-foreground hover:text-wine"
              aria-label={labels.removeAria}
              disabled={isPending && pendingId === row.favoriteId}
              onClick={() => remove(row)}
            >
              <X className="h-4 w-4" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
