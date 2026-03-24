export default function TastingHistoryDetailLoading() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8 pb-12">
      <div className="h-9 w-32 animate-pulse rounded-lg bg-muted" />
      <div className="flex gap-4 border-b border-border/40 pb-6">
        <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-muted" />
        <div className="flex flex-1 flex-col gap-2">
          <div className="h-8 w-3/4 animate-pulse rounded-lg bg-muted" />
          <div className="h-4 w-24 animate-pulse rounded bg-muted/80" />
          <div className="h-3 w-40 animate-pulse rounded bg-muted/60" />
          <div className="h-12 w-full animate-pulse rounded-lg bg-muted/40" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-3 w-16 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted/70" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-muted/70" />
      </div>
      <div className="space-y-3 border-t border-border/30 pt-6">
        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        <div className="h-16 w-full animate-pulse rounded-lg bg-muted/30" />
      </div>
    </div>
  );
}
