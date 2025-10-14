import Skeleton from "@/components/ui/Skeleton";

export default function SettingsProfileLoading() {
  return (
    <section className="rounded-app border border-sub overflow-hidden shadow-app">
      <header className="px-4 pt-3 pb-4 border-b border-white/10">
        <Skeleton className="h-6 w-48" />
      </header>
      <div className="p-4 space-y-5">
        {[...Array(6)].map((_, i) => (
          <div key={i}>
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
        <div className="flex justify-end gap-2 pt-2">
          <Skeleton className="h-9 w-24 rounded-full" />
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
      </div>
    </section>
  );
}
