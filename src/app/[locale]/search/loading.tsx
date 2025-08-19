import Skeleton from "@/components/ui/Skeleton";

export default function SearchLoading() {
  return (
    <section className="rounded-app border border-sub overflow-hidden shadow-app">
      <div className="p-4 border-b border-white/10">
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
      <div className="p-4 space-y-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-5 w-56 mb-2" />
              <Skeleton className="h-4 w-72" />
            </div>
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        ))}
      </div>
    </section>
  );
}
