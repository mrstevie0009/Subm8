import Skeleton from "@/components/ui/Skeleton";

export default function CommunitiesLoading() {
  return (
    <main className="p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(9)].map((_, i) => (
        <section key={i} className="rounded-app border border-sub shadow-app overflow-hidden">
          <Skeleton className="h-28 w-full" />
          <div className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-5 w-40" />
            </div>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </section>
      ))}
    </main>
  );
}
