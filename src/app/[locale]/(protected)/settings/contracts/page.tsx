import Link from 'next/link';

type Params = { locale: string };

export const dynamic = 'force-dynamic';

const contracts = [
  {
    id: '1',
    type: 'Debt Contract',
    partner: '@mistress_luna',
    title: 'Monthly Devotion',
    totalCents: 50000,
    paidCents: 18500,
    status: 'ACTIVE',
    nextDue: '2026-05-01',
  },
  {
    id: '2',
    type: 'BM Contract',
    partner: '@queen_aria',
    title: 'Control Agreement',
    totalCents: 25000,
    paidCents: 25000,
    status: 'COMPLETED',
    nextDue: null,
  },
];

function fmtCents(cents: number) {
  return (cents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: 'EUR',
  });
}

function ProgressRing({ paidCents, totalCents }: { paidCents: number; totalCents: number }) {
  const pct = totalCents > 0 ? Math.min(100, Math.round((paidCents / totalCents) * 100)) : 0;

  return (
    <div
      className="relative grid place-items-center h-28 w-28 rounded-full shrink-0"
      style={{
        background: `conic-gradient(var(--purple) ${pct}%, rgba(255,255,255,.10) 0)`,
      }}
    >
      <div className="absolute inset-2 rounded-full bg-black border border-white/10" />
      <div className="relative text-center">
        <div className="text-xl font-semibold">{pct}%</div>
        <div className="text-[11px] text-white/50">paid</div>
      </div>
    </div>
  );
}

export default async function ContractsPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;

  return (
    <main className="min-h-dvh bg-black text-white pb-24">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/${locale}`}
              className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10"
              aria-label="Back"
            >
              <ChevronLeftIcon />
            </Link>

            <div>
              <h1 className="text-lg font-semibold leading-tight">Contracts</h1>
              <p className="text-xs text-white/50">Debt & BM agreements</p>
            </div>
          </div>

          <Link
            href={`/${locale}/settings/contracts/new`}
            className="grid h-10 w-10 place-items-center rounded-full bg-[var(--purple)] text-white shadow-lg shadow-purple-500/20 hover:opacity-95"
            aria-label="New contract"
          >
            <PlusIcon />
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-2xl gap-4 px-4 py-5">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[.06] to-white/[.02] p-4">
          <div className="text-sm text-white/60">Overview</div>
          <div className="mt-2 grid grid-cols-3 gap-3">
            <Stat label="Active" value="1" />
            <Stat label="Paid" value={fmtCents(43500)} />
            <Stat label="Open" value={fmtCents(31500)} />
          </div>
        </div>

        <div className="grid gap-3">
          {contracts.map((c) => {
            const remaining = Math.max(0, c.totalCents - c.paidCents);

            return (
              <article
                key={c.id}
                className="rounded-3xl border border-white/10 bg-white/[.035] p-4 shadow-[0_18px_60px_-40px_rgba(139,92,246,.8)]"
              >
                <div className="flex items-start gap-4">
                  <ProgressRing paidCents={c.paidCents} totalCents={c.totalCents} />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-purple-400/25 bg-purple-500/10 px-2.5 py-1 text-xs text-purple-200">
                        {c.type}
                      </span>
                      <span
                        className={[
                          'rounded-full border px-2.5 py-1 text-xs',
                          c.status === 'COMPLETED'
                            ? 'border-green-400/25 bg-green-500/10 text-green-200'
                            : 'border-white/10 bg-white/10 text-white/70',
                        ].join(' ')}
                      >
                        {c.status}
                      </span>
                    </div>

                    <h2 className="mt-3 truncate text-base font-semibold">{c.title}</h2>
                    <p className="mt-1 text-sm text-white/55">{c.partner}</p>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                      <MiniAmount label="Paid" value={fmtCents(c.paidCents)} />
                      <MiniAmount label="Remaining" value={fmtCents(remaining)} />
                    </div>

                    {c.nextDue && (
                      <p className="mt-3 text-xs text-white/45">
                        Next due: {new Date(c.nextDue).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
      <div className="text-[11px] text-white/45">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}

function MiniAmount({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="text-[11px] text-white/45">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}