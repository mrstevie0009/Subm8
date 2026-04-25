import Link from 'next/link';

type Params = { locale: string };

export default async function NewContractPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;

  return (
    <main className="min-h-dvh bg-black text-white pb-24">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-3 px-4">
          <Link
            href={`/${locale}/settings/contracts`}
            className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10"
            aria-label="Back"
          >
            ←
          </Link>
          <div>
            <h1 className="text-lg font-semibold leading-tight">New Contract</h1>
            <p className="text-xs text-white/50">Search a user and set up a contract</p>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-2xl px-4 py-5">
        <div className="rounded-3xl border border-white/10 bg-white/[.035] p-4">
          <label className="text-sm text-white/70">Search user</label>
          <input
            placeholder="@username"
            className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-white outline-none focus:border-[var(--purple)]"
          />

          <div className="mt-4 grid gap-3">
            <button className="h-12 rounded-full bg-[var(--purple)] font-semibold text-white">
              Continue
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}