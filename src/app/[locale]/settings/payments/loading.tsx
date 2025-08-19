import Skeleton from "@/components/ui/Skeleton";

export default function PaymentsLoading() {
  return (
    <section className="rounded-app border border-sub overflow-hidden shadow-app">
      {/* Header */}
      <header className="px-4 pt-3 pb-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-7 w-7 rounded-full" />
            <div className="ml-2 sm:ml-3">
              <Skeleton className="h-6 w-56 mb-2" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <Skeleton className="h-9 w-28 rounded-full" />
        </div>
      </header>

      {/* Balance-Block */}
      <section className="border-b border-white/10">
        <div className="px-4 py-8 md:py-10 min-h-[50px] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-9 w-32 rounded-full" />
          </div>
          <Skeleton className="h-8 w-40" />
        </div>
      </section>

      {/* Table Skeleton */}
      <div className="overflow-auto" style={{ maxHeight: "70vh" }}>
        <table className="w-full text-left" style={{ minWidth: 760 }}>
          <thead className="sticky top-0 z-10 bg-black/70 backdrop-blur border-b border-white/10">
            <tr className="[&>th]:py-3 [&>th]:px-4 text-white/80">
              {["Avatar", "Date", "Username", "Amount", "What", "Status"].map((h) => (
                <th key={h}>
                  <Skeleton className="h-5 w-24" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&>tr]:border-b [&>tr]:border-white/10">
            {[...Array(10)].map((_, i) => (
              <tr key={i} className="[&>td]:py-3 [&>td]:px-4 align-middle">
                <td>
                  <Skeleton className="h-10 w-10 rounded-full" />
                </td>
                <td className="whitespace-nowrap">
                  <Skeleton className="h-5 w-36" />
                </td>
                <td className="whitespace-nowrap">
                  <Skeleton className="h-5 w-40" />
                </td>
                <td className="whitespace-nowrap">
                  <Skeleton className="h-5 w-44" />
                </td>
                <td className="whitespace-nowrap">
                  <Skeleton className="h-5 w-48" />
                </td>
                <td className="whitespace-nowrap">
                  <Skeleton className="h-5 w-24" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
