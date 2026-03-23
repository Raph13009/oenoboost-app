import Link from "next/link";

type GrapeTypeEntryProps = {
  redLabel: string;
  whiteLabel: string;
};

export function GrapeTypeEntry({ redLabel, whiteLabel }: GrapeTypeEntryProps) {
  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/cepages?type=red"
        className="rounded-2xl bg-wine px-5 py-8 text-white shadow-sm transition-opacity hover:opacity-95"
      >
        <div className="text-3xl">🍇</div>
        <h2 className="mt-3 font-heading text-3xl">{redLabel}</h2>
      </Link>

      <Link
        href="/cepages?type=white"
        className="rounded-2xl border border-border bg-cream px-5 py-8 text-foreground shadow-sm transition-colors hover:bg-background"
      >
        <div className="text-3xl">🍇</div>
        <h2 className="mt-3 font-heading text-3xl">{whiteLabel}</h2>
      </Link>
    </div>
  );
}
