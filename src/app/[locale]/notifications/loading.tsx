import Skeleton from "@/components/ui/Skeleton";

export default function NotificationsLoading() {
  return (
    <section className="rounded-app border border-sub overflow-hidden shadow-app">
      <header className="px-4 pt-3 pb-4 border-b border-white/10">
        <Skeleton className="h-6 w-44" />
      </header>
      <div className="divide-y divide-white/10">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="px-4 py-3 flex items-start gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-5 w-1/2 mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </div>
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>
        ))}
      </div>
    </section>
  );
}