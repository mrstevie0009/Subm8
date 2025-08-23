export default async function PremiumPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  void locale;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="sticky top-[calc(var(--header-h))] z-10 bg-black/80 backdrop-blur border-b border-white/10">
        <div className="px-4 py-3">
          <h1 className="text-xl font-semibold">Premium</h1>
          <p className="text-sm opacity-70">Unlock more with Subm8 Premium</p>
        </div>
      </div>

      <div className="p-4 grid gap-4">
        <div className="rounded-app border border-sub shadow-app p-6">
          <h2 className="font-semibold mb-1">What you get</h2>
          <ul className="list-disc pl-5 opacity-90 space-y-1">
            <li>Priority in discovery</li>
            <li>Longer videos & media</li>
            <li>Custom themes (soon)</li>
          </ul>
        </div>

        <div className="rounded-app border border-sub shadow-app p-6">
          <h2 className="font-semibold mb-3">Plans</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 p-4">
              <div className="font-semibold">Monthly</div>
              <div className="text-2xl mt-1">$9</div>
              <button className="mt-3 px-4 py-1.5 rounded-full bg-[var(--purple)] text-white hover:opacity-95">
                Choose
              </button>
            </div>
            <div className="rounded-xl border border-white/10 p-4">
              <div className="font-semibold">Yearly</div>
              <div className="text-2xl mt-1">$89</div>
              <button className="mt-3 px-4 py-1.5 rounded-full border border-white/20 hover:bg-white/5">
                Choose
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
