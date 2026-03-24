export default function TastingHistoryLoading() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 pb-12">
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded bg-muted/80" />
      </div>
      <ul className="flex flex-col gap-3">
        {["a", "b", "c"].map((k) => (
          <li
            key={k}
            className="h-28 animate-pulse rounded-2xl border border-border/40 bg-muted/30"
          />
        ))}
      </ul>
    </div>
  );
}
