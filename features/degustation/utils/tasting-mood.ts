import type { TastingSheet } from "@/types/database";

export type TastingMoodKey = "balanced" | "fresh" | "powerful";

/** Heuristique simple pour pastille carte + résumé. */
export function computeTastingMood(
  s: Pick<
    TastingSheet,
    "mouth_acidity" | "mouth_tannins" | "mouth_length_caudalie"
  >,
): TastingMoodKey {
  const ac = s.mouth_acidity ?? 5;
  const tn = s.mouth_tannins ?? 5;
  const len = s.mouth_length_caudalie ?? 5;
  const score = (ac + tn + len) / 3;
  if (score < 4.5) return "fresh";
  if (score > 6.5) return "powerful";
  return "balanced";
}

/** Phrase courte sous le titre (fiche détail). */
export function buildAutoSummaryLine(
  s: TastingSheet,
  t: {
    summaryBalanced: string;
    summaryFresh: string;
    summaryPowerful: string;
  },
): string {
  const mood = computeTastingMood(s);
  if (mood === "fresh") return t.summaryFresh;
  if (mood === "powerful") return t.summaryPowerful;
  return t.summaryBalanced;
}
