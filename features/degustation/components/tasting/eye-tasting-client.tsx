"use client";

import Link from "next/link";

import { buttonVariants } from "@/components/ui/button-variants";
import { TastingStepShell } from "@/features/degustation/components/tasting/tasting-step-shell";
import { SegmentedRow } from "@/features/degustation/components/tasting/segmented";
import { useTastingFlow } from "@/features/degustation/tasting/tasting-flow-context";
import {
  WINE_COLOR_GROUPS,
  colorLabelKey,
  type WineColorId,
} from "@/features/degustation/tasting/wine-colors";
import type { Dictionary } from "@/lib/i18n/dictionaries/fr";
import { cn } from "@/lib/utils";

type Props = {
  labels: Dictionary["tastingFlow"];
};

export function EyeTastingClient({ labels }: Props) {
  const { draft, patch } = useTastingFlow();

  const colorLabel = (id: WineColorId) => {
    const k = colorLabelKey(id) as keyof Dictionary["tastingFlow"];
    return labels[k] ?? id;
  };

  return (
    <TastingStepShell
      step={1}
      title={labels.stepEye}
      scrollContent
      footer={
        <div className="flex justify-center px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Link
            href="/degustation/nez/start"
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
      <div className="flex h-full min-h-0 flex-col gap-5 py-3 sm:gap-6 sm:py-4">
        {WINE_COLOR_GROUPS.map((g) => (
          <div key={g.groupKey} className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {labels[g.groupKey]}
            </p>
            <div
              className={cn(
                "grid gap-2 sm:gap-3",
                g.colors.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4",
              )}
            >
              {g.colors.map((c) => {
                const active = draft.eye_color === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => patch({ eye_color: c.id })}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-2xl border p-2 transition-all active:scale-[0.98] sm:gap-2 sm:p-3",
                      active
                        ? "border-wine shadow-[0_0_20px_-4px_rgba(124,39,54,0.45)]"
                        : "border-border/50 bg-card/40 hover:border-wine/25 dark:bg-card/30",
                    )}
                  >
                    <span
                      className="h-9 w-full rounded-lg shadow-inner sm:h-10"
                      style={{ backgroundColor: c.hex }}
                    />
                    <span className="text-center text-[10px] leading-tight text-foreground sm:text-xs">
                      {colorLabel(c.id)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {labels.labelRobe}
          </p>
          <SegmentedRow
            value={draft.eye_robe}
            onChange={(v) => patch({ eye_robe: v })}
            options={[
              { value: "pale", label: labels.robePale },
              { value: "medium", label: labels.robeMedium },
              { value: "deep", label: labels.robeDeep },
            ]}
          />
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {labels.labelIntensity}
          </p>
          <SegmentedRow
            value={draft.eye_intensity}
            onChange={(v) => patch({ eye_intensity: v })}
            options={[
              { value: "light", label: labels.intensityLight },
              { value: "medium", label: labels.intensityMedium },
              { value: "intense", label: labels.intensityIntense },
            ]}
          />
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {labels.labelTears}
          </p>
          <SegmentedRow
            value={draft.eye_tears}
            onChange={(v) => patch({ eye_tears: v })}
            options={[
              { value: "none", label: labels.tearsNone },
              { value: "light", label: labels.tearsLight },
              { value: "pronounced", label: labels.tearsPronounced },
            ]}
          />
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {labels.labelNotes}
          </p>
          <textarea
            value={draft.eye_notes ?? ""}
            onChange={(e) => patch({ eye_notes: e.target.value || null })}
            placeholder={labels.eyeNotesPlaceholder}
            rows={2}
            className="w-full resize-none rounded-xl border border-border/60 bg-card/50 px-3 py-2.5 text-sm outline-none ring-ring/50 placeholder:text-muted-foreground focus-visible:border-wine/40 focus-visible:ring-2 dark:bg-card/30"
          />
        </div>
      </div>
    </TastingStepShell>
  );
}
