"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Layers, X } from "lucide-react";

import { toggleSoilFavoriteAction } from "@/features/sols/actions/soil-favorite-actions";
import type { FavoriteSoilRow } from "@/features/sols/queries/soil-favorites.queries";
import { Button } from "@/components/ui/button";

type Labels = {
  removeAria: string;
};

type Props = {
  initialItems: FavoriteSoilRow[];
  labels: Labels;
};

export function FavoriteSoilsList({ initialItems, labels }: Props) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const remove = (row: FavoriteSoilRow) => {
    setPendingId(row.favoriteId);
    startTransition(async () => {
      await toggleSoilFavoriteAction(row.soil.id, row.soil.slug);
      setPendingId(null);
      router.refresh();
    });
  };

  return (
    <ul className="flex flex-col gap-3">
      {initialItems.map((row) => (
        <li
          key={row.favoriteId}
          className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/20"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background text-wine">
            <Layers className="h-4 w-4" aria-hidden />
          </div>
          <Link
            href={`/sols/${row.soil.slug}?from=favorites`}
            className="min-w-0 flex-1 font-medium text-foreground transition-colors hover:text-wine"
          >
            <span className="block truncate">{row.soil.name_fr}</span>
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
      ))}
    </ul>
  );
}
