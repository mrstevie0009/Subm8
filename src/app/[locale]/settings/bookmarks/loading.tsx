import Skeleton from "@/components/ui/Skeleton";

export default function BookmarksLoading() {
  return (
    <section className="rounded-app border border-sub overflow-hidden shadow-app">
      <header className="px-4 pt-3 pb-4 border-b border-white/10">
        <Skeleton className="h-6 w-44" />
      </header>
      <div className="p-4 space-y-4">
        {[...Array(8)].map((_, i) => (
          <article key={i} className="rounded-lg border border-white/10 p-4">
            <div className="flex items-center gap-3 mb-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-5 w-40" />
            </div>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4" />
          </article>
        ))}
      </div>
    </section>
  );
}
