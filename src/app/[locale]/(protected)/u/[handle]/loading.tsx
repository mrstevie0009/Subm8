// hübsches, kompaktes Profil-Skeleton für schnellere Wahrnehmung
export default function PublicProfileLoading() {
  return (
    <section className="rounded-app border border-sub overflow-hidden shadow-app">
      {/* Banner + Avatar */}
      <div className="relative">
        <div className="h-32 w-full bg-white/10 animate-pulse" />
        <div className="absolute -bottom-8 left-4 h-20 w-20 rounded-full bg-white/15 border border-white/20 animate-pulse" />
      </div>

      {/* Name + Handle + Meta */}
      <div className="px-4 pt-12 pb-4 border-b border-white/10">
        <div className="h-6 w-48 bg-white/12 rounded animate-pulse mb-2" />
        <div className="h-4 w-40 bg-white/10 rounded animate-pulse mb-2" />
        <div className="h-4 w-64 bg-white/8 rounded animate-pulse" />
      </div>

      {/* Tabs-Leiste (Dummy) */}
      <div className="px-4 py-3 border-b border-white/10 flex gap-3">
        <div className="h-8 w-20 rounded-full bg-white/10 animate-pulse" />
        <div className="h-8 w-24 rounded-full bg-white/10 animate-pulse" />
        <div className="h-8 w-28 rounded-full bg-white/10 animate-pulse" />
      </div>

      {/* Erste Karten-Skeletons */}
      <div className="p-4 grid gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <article key={i} className="rounded-lg border border-white/10 p-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-white/10 animate-pulse" />
              <div className="flex-1 min-w-0">
                <div className="h-3 w-40 bg-white/12 rounded animate-pulse" />
                <div className="mt-2 h-3 w-[90%] bg-white/10 rounded animate-pulse" />
                <div className="mt-2 h-3 w-[70%] bg-white/10 rounded animate-pulse" />
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
