import Skeleton from "@/components/ui/Skeleton";

export default function ChatThreadLoading() {
  return (
    <section className="rounded-app border border-sub overflow-hidden shadow-app">
      <header className="px-4 pt-3 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div>
            <Skeleton className="h-5 w-40 mb-2" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </header>
      <div className="p-4 space-y-4">
        {/* bubbles */}
        {[...Array(8)].map((_, i) => (
          <div key={i} className={i % 2 ? "flex justify-end" : "flex justify-start"}>
            <Skeleton className="h-10 w-56 rounded-2xl" />
          </div>
        ))}
      </div>
      <footer className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 flex-1 rounded-xl" />
          <Skeleton className="h-10 w-20 rounded-xl" />
        </div>
      </footer>
    </section>
  );
}
