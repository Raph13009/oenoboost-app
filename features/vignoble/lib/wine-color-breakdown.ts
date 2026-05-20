import type { Appellation } from "../types";

export type WineColorKey = "red" | "white" | "sparkling" | "liqueur";

export type WineColorBreakdown = Record<WineColorKey, number>;

export const WINE_COLOR_ORDER = [
  "red",
  "white",
  "sparkling",
  "liqueur",
] as const satisfies readonly WineColorKey[];

/** Returns segment percentages when at least one value is set and total > 0. */
export function getWineColorBreakdown(
  appellation: Pick<
    Appellation,
    | "wine_pct_red"
    | "wine_pct_white"
    | "wine_pct_sparkling"
    | "wine_pct_liqueur"
  >,
): WineColorBreakdown | null {
  const values = {
    red: appellation.wine_pct_red,
    white: appellation.wine_pct_white,
    sparkling: appellation.wine_pct_sparkling,
    liqueur: appellation.wine_pct_liqueur,
  };

  const allNull = Object.values(values).every((v) => v === null);
  if (allNull) return null;

  const breakdown: WineColorBreakdown = {
    red: values.red ?? 0,
    white: values.white ?? 0,
    sparkling: values.sparkling ?? 0,
    liqueur: values.liqueur ?? 0,
  };

  const total =
    breakdown.red + breakdown.white + breakdown.sparkling + breakdown.liqueur;
  if (total <= 0) return null;

  return breakdown;
}

export function buildConicGradient(
  breakdown: WineColorBreakdown,
  colors: Record<WineColorKey, string>,
): string {
  const segments = WINE_COLOR_ORDER.map((key) => ({
    key,
    value: breakdown[key],
  })).filter((s) => s.value > 0);

  let cursor = 0;
  const stops = segments.map((segment) => {
    const start = cursor;
    cursor += segment.value;
    return `${colors[segment.key]} ${start}% ${cursor}%`;
  });

  return `conic-gradient(from -90deg, ${stops.join(", ")})`;
}
