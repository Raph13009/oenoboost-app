"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { buttonVariants } from "@/components/ui/button-variants";
import { saveTastingSheetAction } from "@/features/degustation/actions/tasting-sheet-actions";
import { TastingStepShell } from "@/features/degustation/components/tasting/tasting-step-shell";
import { SegmentedRow } from "@/features/degustation/components/tasting/segmented";
import { TastingRange } from "@/features/degustation/components/tasting/tasting-range";
import { draftToInsert } from "@/features/degustation/tasting/tasting-draft";
import { useTastingFlow } from "@/features/degustation/tasting/tasting-flow-context";
import type { Dictionary } from "@/lib/i18n/dictionaries/fr";
import { cn } from "@/lib/utils";

type Props = {
  labels: Dictionary["tastingFlow"];
  loginLabel: string;
};

export function MouthTastingClient({ labels, loginLabel }: Props) {
  const router = useRouter();
  const { draft, patch, reset } = useTastingFlow();
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const t = window.setTimeout(() => {
      router.replace("/degustation");
    }, 1200);
    return () => window.clearTimeout(t);
  }, [saved, router]);

  const onSave = async () => {
    setErr(null);
    setPending(true);
    const payload = draftToInsert(draft);
    const res = await saveTastingSheetAction(payload);
    setPending(false);
    if (!res.ok) {
      if (res.error === "AUTH_REQUIRED") {
        setErr(labels.loginToSave);
        return;
      }
      setErr(res.message ?? "Error");
      return;
    }
    reset();
    setSaved(true);
  };

  return (
    <TastingStepShell
      step={3}
      title={labels.stepMouth}
      scrollContent
      footer={
        <div className="relative flex flex-col gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {saved ? (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 backdrop-blur-[2px]"
              role="status"
              aria-live="polite"
            >
              <div className="tasting-saved-pop flex max-w-sm flex-col items-center gap-3 px-8 text-center">
                <CheckCircle2
                  className="h-14 w-14 text-wine"
                  strokeWidth={1.25}
                  aria-hidden
                />
                <p className="font-heading text-xl font-semibold text-wine">
                  {labels.successTitle}
                </p>
                <p className="text-sm text-muted-foreground">{labels.successBody}</p>
              </div>
            </div>
          ) : null}
          {err ? (
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-xs text-destructive">{err}</p>
              <Link
                href="/login?next=/degustation/bouche/start"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "border-wine/30 text-wine",
                )}
              >
                {loginLabel}
              </Link>
            </div>
          ) : null}
          <div className="flex justify-center">
            <button
              type="button"
              disabled={pending || saved}
              onClick={onSave}
              className={cn(
                buttonVariants({ variant: "default", size: "lg" }),
                "w-full max-w-md bg-wine text-primary-foreground hover:opacity-90 sm:w-auto sm:min-w-44",
              )}
            >
              {pending ? labels.saving : labels.save}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5 py-3 sm:gap-6 sm:py-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {labels.wineNameLabel}
            </label>
            <input
              type="text"
              value={draft.wine_name}
              onChange={(e) => patch({ wine_name: e.target.value })}
              className="h-11 w-full rounded-xl border border-border/60 bg-card/50 px-3 text-sm outline-none focus-visible:border-wine/40 focus-visible:ring-2 dark:bg-card/30"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {labels.vintageLabel}
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={draft.vintage}
              onChange={(e) => patch({ vintage: e.target.value.replace(/\D/g, "").slice(0, 4) })}
              placeholder="2020"
              className="h-11 w-full rounded-xl border border-border/60 bg-card/50 px-3 text-sm outline-none focus-visible:border-wine/40 focus-visible:ring-2 dark:bg-card/30"
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {labels.mouthAttack}
          </p>
          <SegmentedRow
            value={draft.mouth_attack}
            onChange={(v) => patch({ mouth_attack: v })}
            options={[
              { value: "soft", label: labels.attackSoft },
              { value: "medium", label: labels.attackMedium },
              { value: "strong", label: labels.attackStrong },
            ]}
          />
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {labels.mouthMid}
          </p>
          <SegmentedRow
            value={draft.mouth_mid}
            onChange={(v) => patch({ mouth_mid: v })}
            options={[
              { value: "light", label: labels.midLight },
              { value: "round", label: labels.midRound },
              { value: "full", label: labels.midFull },
            ]}
          />
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {labels.mouthFinish}
          </p>
          <SegmentedRow
            value={draft.mouth_finish}
            onChange={(v) => patch({ mouth_finish: v })}
            options={[
              { value: "short", label: labels.finishShort },
              { value: "medium", label: labels.finishMedium },
              { value: "long", label: labels.finishLong },
            ]}
          />
        </div>

        <div className="space-y-4 rounded-2xl border border-border/40 bg-card/30 p-4 dark:bg-card/20">
          <TastingRange
            label={labels.sliderAcidity}
            value={draft.mouth_acidity ?? 5}
            onChange={(n) => patch({ mouth_acidity: n })}
          />
          <TastingRange
            label={labels.sliderTannins}
            value={draft.mouth_tannins ?? 5}
            onChange={(n) => patch({ mouth_tannins: n })}
          />
          <TastingRange
            label={labels.sliderAlcohol}
            value={draft.mouth_alcohol ?? 5}
            onChange={(n) => patch({ mouth_alcohol: n })}
          />
          <TastingRange
            label={labels.sliderSugar}
            value={draft.mouth_sugar ?? 5}
            onChange={(n) => patch({ mouth_sugar: n })}
          />
          <TastingRange
            label={labels.sliderLength}
            value={draft.mouth_length_caudalie ?? 5}
            onChange={(n) => patch({ mouth_length_caudalie: n })}
            hint={labels.lengthScale}
          />
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {labels.labelNotes}
          </label>
          <textarea
            value={draft.mouth_notes ?? ""}
            onChange={(e) => patch({ mouth_notes: e.target.value || null })}
            placeholder={labels.mouthNotesPlaceholder}
            rows={4}
            className="w-full resize-none rounded-xl border border-border/60 bg-card/50 px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-wine/40 focus-visible:ring-2 dark:bg-card/30"
          />
        </div>
      </div>
    </TastingStepShell>
  );
}
