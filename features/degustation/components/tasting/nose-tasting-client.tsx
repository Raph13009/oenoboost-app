"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button-variants";
import { TastingStepShell } from "@/features/degustation/components/tasting/tasting-step-shell";
import { SegmentedRow } from "@/features/degustation/components/tasting/segmented";
import { useTastingFlow } from "@/features/degustation/tasting/tasting-flow-context";
import type { Dictionary } from "@/lib/i18n/dictionaries/fr";
import { cn } from "@/lib/utils";

const AROMAS: { id: string; key: keyof Dictionary["tastingFlow"] }[] = [
  { id: "Fruity", key: "aromaFruity" },
  { id: "Floral", key: "aromaFloral" },
  { id: "Spicy", key: "aromaSpicy" },
  { id: "Woody", key: "aromaWoody" },
  { id: "Mineral", key: "aromaMineral" },
  { id: "Vegetal", key: "aromaVegetal" },
  { id: "Fermented", key: "aromaFermented" },
];

type Props = {
  labels: Dictionary["tastingFlow"];
};

export function NoseTastingClient({ labels }: Props) {
  const { draft, patch } = useTastingFlow();
  const families = draft.nose_aroma_families ?? [];

  const toggleAroma = (id: string) => {
    const next = families.includes(id)
      ? families.filter((x) => x !== id)
      : [...families, id];
    patch({ nose_aroma_families: next });
  };

  return (
    <TastingStepShell
      step={2}
      title={labels.stepNose}
      scrollContent
      footer={
        <div className="flex justify-center px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Link
            href="/degustation/bouche/start"
            className={cn(
              buttonVariants({ variant: "default", size: "lg" }),
              "w-full max-w-md bg-wine text-primary-foreground hover:opacity-90 sm:w-auto sm:min-w-40",
            )}
          >
            {labels.next}
          </Link>
        </div>
      }
    >
      <div className="flex flex-col gap-5 py-3 sm:gap-6 sm:py-4">
        <div className="space-y-2">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {labels.firstNoseLabel}
          </label>
          <textarea
            value={draft.nose_first_nose ?? ""}
            onChange={(e) => patch({ nose_first_nose: e.target.value || null })}
            placeholder={labels.noseFirstPlaceholder}
            rows={3}
            className="w-full resize-none rounded-xl border border-border/60 bg-card/50 px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-wine/40 focus-visible:ring-2 dark:bg-card/30"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {labels.secondNoseLabel}
          </label>
          <textarea
            value={draft.nose_second_nose ?? ""}
            onChange={(e) => patch({ nose_second_nose: e.target.value || null })}
            placeholder={labels.noseSecondPlaceholder}
            rows={3}
            className="w-full resize-none rounded-xl border border-border/60 bg-card/50 px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-wine/40 focus-visible:ring-2 dark:bg-card/30"
          />
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {labels.aromaFamiliesLabel}
          </p>
          <div className="flex flex-wrap gap-2">
            {AROMAS.map((a) => {
              const on = families.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleAroma(a.id)}
                  className={cn(
                    "rounded-full border px-3 py-2 text-xs font-medium transition-all active:scale-[0.98] sm:text-sm",
                    on
                      ? "border-wine bg-wine/12 text-wine shadow-sm"
                      : "border-border/60 bg-card/40 text-foreground hover:border-wine/25 dark:bg-card/30",
                  )}
                >
                  {labels[a.key]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {labels.labelNoseIntensity}
          </p>
          <SegmentedRow
            value={draft.nose_intensity}
            onChange={(v) => patch({ nose_intensity: v })}
            options={[
              { value: "light", label: labels.noseIntLow },
              { value: "medium", label: labels.noseIntMid },
              { value: "pronounced", label: labels.noseIntHigh },
            ]}
          />
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {labels.labelNotes}
          </label>
          <textarea
            value={draft.nose_notes ?? ""}
            onChange={(e) => patch({ nose_notes: e.target.value || null })}
            placeholder={labels.noseNotesPlaceholder}
            rows={3}
            className="w-full resize-none rounded-xl border border-border/60 bg-card/50 px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-wine/40 focus-visible:ring-2 dark:bg-card/30"
          />
        </div>
      </div>
    </TastingStepShell>
  );
}
