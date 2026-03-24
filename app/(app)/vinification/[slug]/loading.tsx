export default function VinificationDetailLoading() {
  return (
    <div className="flex flex-col gap-8 pb-12">
      <div className="h-5 w-40 animate-pulse rounded bg-muted" />
      <div className="flex flex-col gap-2">
        <div className="h-9 max-w-md animate-pulse rounded bg-muted md:h-11" />
        <div className="h-4 max-w-xl animate-pulse rounded bg-muted" />
      </div>
      <div className="flex flex-col gap-6">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-28 max-w-3xl animate-pulse rounded-xl bg-muted"
          />
        ))}
      </div>
    </div>
  );
}
