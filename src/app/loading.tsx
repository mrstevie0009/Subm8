import Skeleton from "@/components/ui/Skeleton";

export default function RootLoading() {
  return (
    <main className="p-4 md:p-8">
      <section className="rounded-app border border-sub overflow-hidden shadow-app">
        <header className="px-4 pt-3 pb-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-7 w-7 rounded-full" />
              <div>
                <Skeleton className="h-5 w-40 mb-2" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>
            <Skeleton className="h-9 w-28 rounded-full" />
          </div>
        </header>

        <div className="p-4 md:p-6">
          {/* Dummy content blocks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <div className="mt-6">
            <Skeleton className="h-6 w-40 mb-4" />
            {[...Array(6)].map((_, i) => (
              <div key={i} className="grid grid-cols-4 gap-4 mb-3">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
