import Skeleton from "@/components/ui/Skeleton";

export default function ChatListLoading() {
  return (
    <section className="rounded-app border border-sub overflow-hidden shadow-app">
      <header className="px-4 pt-3 pb-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
      </header>
      <div className="divide-y divide-white/10">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-5 w-1/2 mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </section>
  );
}
