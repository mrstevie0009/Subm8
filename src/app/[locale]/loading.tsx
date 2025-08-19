import Skeleton from "@/components/ui/Skeleton";

export default function LocaleSegmentLoading() {
  return (
    <main className="p-4 md:p-6">
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
        <div className="p-4 grid gap-4 md:grid-cols-2">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </section>
    </main>
  );
}
