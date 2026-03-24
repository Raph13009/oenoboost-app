import Link from "next/link";
import { Wine } from "lucide-react";

import { buttonVariants } from "@/components/ui/button-variants";
import type { Dictionary } from "@/lib/i18n/dictionaries/fr";
import { cn } from "@/lib/utils";

type Props = {
  labels: Dictionary["tastingHistory"];
};

export function TastingHistoryEmpty({ labels }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 rounded-2xl border border-dashed border-border/60 bg-muted/20 px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-wine/10 text-wine">
        <Wine className="h-8 w-8" strokeWidth={1.5} />
      </div>
      <div className="space-y-2">
        <h2 className="font-heading text-xl font-semibold text-foreground">
          {labels.emptyTitle}
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground">{labels.emptyBody}</p>
      </div>
      <Link
        href="/degustation/oeil/start"
        className={cn(
          buttonVariants({ variant: "default", size: "lg" }),
          "bg-wine text-primary-foreground hover:opacity-90",
        )}
      >
        {labels.ctaStart}
      </Link>
    </div>
  );
}
