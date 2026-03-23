"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Grape as GrapeIcon, X } from "lucide-react";

import { toggleGrapeFavoriteAction } from "@/features/cepages/actions/grape-favorite-actions";
import type { FavoriteGrapeRow } from "@/features/cepages/queries/favorites.queries";
import { getContent } from "@/lib/i18n/get-content";
import type { Locale } from "@/lib/i18n/config";
import { Button } from "@/components/ui/button";

type Labels = {
  red: string;
  white: string;
  rose: string;
  removeAria: string;
};

type Props = {
  initialItems: FavoriteGrapeRow[];
  locale: Locale;
  labels: Labels;
};

export function FavoriteGrapesList({ initialItems, locale, labels }: Props) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const typeLabel = (t: "red" | "white" | "rose") =>
    t === "red" ? labels.red : t === "white" ? labels.white : labels.rose;

  const remove = (row: FavoriteGrapeRow) => {
    setPendingId(row.favoriteId);
    startTransition(async () => {
      await toggleGrapeFavoriteAction(row.grape.id, row.grape.slug);
      setPendingId(null);
      router.refresh();
    });
  };

  return (
    <ul className="flex flex-col gap-3">
      {initialItems.map((row) => {
        const name = getContent(row.grape, "name", locale);
        return (
          <li
            key={row.favoriteId}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/20"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background text-wine">
              <GrapeIcon className="h-4 w-4" aria-hidden />
            </div>
            <Link
              href={`/cepages/${row.grape.slug}?from=favorites`}
              className="min-w-0 flex-1 font-medium text-foreground transition-colors hover:text-wine"
            >
              <span className="block truncate">{name}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {typeLabel(row.grape.type)}
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
