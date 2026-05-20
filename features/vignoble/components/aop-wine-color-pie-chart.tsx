import {
  buildConicGradient,
  WINE_COLOR_ORDER,
  type WineColorBreakdown,
  type WineColorKey,
} from "../lib/wine-color-breakdown";

const SEGMENT_COLORS: Record<WineColorKey, string> = {
  red: "var(--chart-1)",
  white: "#f5f0e8",
  sparkling: "var(--chart-3)",
  liqueur: "var(--chart-5)",
};

export type AopWineColorPieChartLabels = {
  title: string;
  red: string;
  white: string;
  sparkling: string;
  liqueur: string;
};

type Props = {
  breakdown: WineColorBreakdown;
  labels: AopWineColorPieChartLabels;
};

const LABEL_BY_KEY: Record<WineColorKey, keyof AopWineColorPieChartLabels> = {
  red: "red",
  white: "white",
  sparkling: "sparkling",
  liqueur: "liqueur",
};

export function AopWineColorPieChart({ breakdown, labels }: Props) {
  const segments = WINE_COLOR_ORDER.map((key) => ({
    key,
    value: breakdown[key],
  })).filter((s) => s.value > 0);

  const gradient = buildConicGradient(breakdown, SEGMENT_COLORS);

  return (
    <section className="rounded-xl border border-border bg-card p-4 md:p-5">
      <h2 className="font-heading text-xl font-semibold">{labels.title}</h2>

      <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-center sm:gap-10">
        <div
          className="relative h-44 w-44 shrink-0 rounded-full md:h-52 md:w-52"
          style={{ background: gradient }}
          role="img"
          aria-label={segments
            .map((s) => `${labels[LABEL_BY_KEY[s.key]]} ${s.value}%`)
            .join(", ")}
        >
          <div
            className="absolute inset-[22%] rounded-full bg-card"
            aria-hidden
          />
        </div>

        <ul className="grid w-full max-w-sm grid-cols-1 gap-2.5 sm:max-w-none">
          {segments.map((segment) => (
            <li
              key={segment.key}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background px-3 py-2"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  className="h-3 w-3 shrink-0 rounded-full border border-border/60"
                  style={{ backgroundColor: SEGMENT_COLORS[segment.key] }}
                  aria-hidden
                />
                <span className="truncate text-sm font-medium">
                  {labels[LABEL_BY_KEY[segment.key]]}
                </span>
              </span>
              <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                {segment.value}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
