export default function LoadingCommunity() {
  return (
    <section className="grid gap-4 max-w-2xl mx-auto">
      {/* Header-Skeleton */}
      <header className="rounded-app border border-sub shadow-app p-4 overflow-hidden">
        <div className="-mx-4 -mt-4 mb-3 h-28 bg-white/10 animate-pulse" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 pl-10">
            <div className="h-5 w-52 bg-white/10 rounded animate-pulse" />
            <div className="mt-2 h-3 w-40 bg-white/10 rounded animate-pulse" />
            <div className="mt-3 h-3 w-[85%] bg-white/10 rounded animate-pulse" />
            <div className="mt-2 h-3 w-[60%] bg-white/10 rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-24 bg-white/10 rounded-full animate-pulse" />
            <div className="h-9 w-10 bg-white/10 rounded-full animate-pulse" />
            <div className="h-9 w-10 bg-white/10 rounded-full animate-pulse" />
          </div>
        </div>
      </header>

      {/* Compact-Header + Composer Skeleton */}
      <div className="rounded-app border border-sub shadow-app p-3">
        <div className="h-5 w-40 bg-white/10 rounded animate-pulse" />
      </div>
      <div className="rounded-app border border-sub shadow-app p-4">
        <div className="h-10 w-full bg-white/10 rounded animate-pulse" />
      </div>

      {/* Feed-Skeletons */}
      <div className="grid gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-app border border-sub shadow-app p-4">
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-full bg-white/10 animate-pulse" />
              <div className="min-w-0 flex-1">
                <div className="h-3 w-40 bg-white/10 rounded animate-pulse" />
                <div className="mt-2 h-3 w-[90%] bg-white/10 rounded animate-pulse" />
                <div className="mt-2 h-3 w-[70%] bg-white/10 rounded animate-pulse" />
                <div className="mt-3 h-40 w-full bg-white/10 rounded animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
