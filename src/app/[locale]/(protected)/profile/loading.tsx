import Skeleton from "@/components/ui/Skeleton";

export default function ProfileLoading() {
  return (
    <section className="rounded-app border border-sub overflow-hidden shadow-app">
      <div className="relative">
        <Skeleton className="h-32 w-full" />
        <div className="absolute -bottom-8 left-4">
          <Skeleton className="h-20 w-20 rounded-full" />
        </div>
      </div>
      <div className="px-4 pt-12 pb-4 border-b border-white/10">
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-72 mb-2" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="p-4 space-y-4">
        {[...Array(6)].map((_, i) => (
          <article key={i} className="rounded-lg border border-white/10 p-4">
            <div className="flex items-center gap-3 mb-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-5 w-40 mb-1" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-3/4" />
          </article>
        ))}
      </div>
    </section>
  );
}
