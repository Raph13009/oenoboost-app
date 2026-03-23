export default function AopListLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-6 w-28 animate-pulse rounded bg-muted" />
      <div className="h-10 w-56 animate-pulse rounded bg-muted" />

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-3">
        <div className="h-10 animate-pulse rounded bg-muted" />
        <div className="h-10 animate-pulse rounded bg-muted" />
        <div className="h-10 animate-pulse rounded bg-muted" />
      </div>

      <div className="flex flex-col gap-3">
        <div className="h-16 animate-pulse rounded-xl bg-muted" />
        <div className="h-16 animate-pulse rounded-xl bg-muted" />
        <div className="h-16 animate-pulse rounded-xl bg-muted" />
        <div className="h-16 animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  );
}
