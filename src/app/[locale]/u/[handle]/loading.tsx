import Skeleton from "@/components/ui/Skeleton";

export default function PublicProfileLoading() {
  return (
    <section className="rounded-app border border-sub overflow-hidden shadow-app">
      <div className="relative">
        <Skeleton className="h-28 w-full" />
        <div className="absolute -bottom-8 left-4">
          <Skeleton className="h-20 w-20 rounded-full" />
        </div>
      </div>
      <div className="px-4 pt-12 pb-4 border-b border-white/10">
        <Skeleton className="h-6 w-44 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="p-4 space-y-4">
        {[...Array(5)].map((_, i) => (
          <article key={i} className="rounded-lg border border-white/10 p-4">
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4" />
          </article>
        ))}
      </div>
    </section>
  );
}
