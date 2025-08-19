import Skeleton from "@/components/ui/Skeleton";

export default function SettingsIndexLoading() {
  return (
    <section className="rounded-app border border-sub overflow-hidden shadow-app">
      <header className="px-4 pt-3 pb-4 border-b border-white/10">
        <Skeleton className="h-6 w-40" />
      </header>
      <div className="p-4 grid gap-4 sm:grid-cols-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-lg border border-white/10 p-4">
            <Skeleton className="h-5 w-36 mb-3" />
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </section>
  );
}
