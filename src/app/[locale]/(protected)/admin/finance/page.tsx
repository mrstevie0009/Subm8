// src/app/[locale]/admin/finance/page.tsx
'use client';

import * as React from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';

type Summary = { ok: true; totals: { gross: number; platform: number; processor: number; vat: number }; count: number; currency: string };
type Oss = { ok: true; items: Array<{ country: string; netBaseCents: number; vatCents: number }> };
type EvidenceResp = {
  ok: true;
  totals: { total: number; compliant: number; compliantPct: number };
  rows: Array<{ id: string; date: string; buyerCountry: string; types: string[]; countries: string[]; ok: boolean }>;
};

function fmt(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format((cents || 0) / 100);
}

export default function AdminFinancePage() {
  const locale = useLocale();
  const [from, setFrom] = React.useState<string>(() => new Date(Date.now() - 29 * 24 * 3600 * 1000).toISOString().slice(0, 10));
  const [to, setTo] = React.useState<string>(() => new Date().toISOString().slice(0, 10));

  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [oss, setOss] = React.useState<Oss | null>(null);
  const [evidence, setEvidence] = React.useState<EvidenceResp | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    try {
      setLoading(true);
      setErr(null);
      const [a, b, c] = await Promise.all([
        fetch(`/api/admin/finance/summary?from=${from}&to=${to}`, { cache: 'no-store' }).then((r) => r.json()),
        fetch(`/api/admin/finance/oss?from=${from}&to=${to}`, { cache: 'no-store' }).then((r) => r.json()),
        fetch(`/api/admin/finance/oss-evidence?from=${from}&to=${to}`, { cache: 'no-store' }).then((r) => r.json()),
      ]);
      setSummary(a);
      setOss(b);
      setEvidence(c);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <main className="mx-auto px-3" style={{ maxWidth: 1080 }}>
      <div className="flex items-center gap-3 mb-3">
        <Link href={`/${locale}/admin`} className="p-1 rounded hover:bg-white/10" aria-label="Back">
          ←
        </Link>
        <h1 className="text-xl font-semibold">Finance & VAT (Admin)</h1>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <label className="text-sm">From</label>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-white/5 border border-white/10 rounded px-2 py-1" />
        <label className="text-sm">To</label>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-white/5 border border-white/10 rounded px-2 py-1" />
        <button onClick={reload} className="ml-2 px-3 py-1.5 rounded bg-[var(--purple)] text-white hover:opacity-95">
          Refresh
        </button>
        {loading && <span className="text-sm text-white/70 ml-2">Loading…</span>}
        {err && <span className="text-sm text-red-400 ml-2">{err}</span>}
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card label="Brutto (You pay)" value={fmt(summary?.totals.gross ?? 0)} />
        <Card label="Plattform-Gebühr (Brutto)" value={fmt(summary?.totals.platform ?? 0)} />
        <Card label="Provider Fee (Segpay)" value={fmt(summary?.totals.processor ?? 0)} />
        <Card label="VAT (zur Abführung)" value={fmt(summary?.totals.vat ?? 0)} />
      </section>

      {/* OSS je Land */}
      <section className="rounded-app border border-sub overflow-hidden shadow-app mt-4">
        <div className="px-4 py-3 border-b border-white/10 font-semibold">OSS-Aufstellung pro Land</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-white/70">
              <tr className="border-b border-white/10">
                <th className="px-3 py-2 text-left">Land</th>
                <th className="px-3 py-2 text-right">Netto-Umsatz</th>
                <th className="px-3 py-2 text-right">VAT</th>
              </tr>
            </thead>
            <tbody>
              {!oss?.items?.length ? (
                <tr>
                  <td className="px-3 py-3 text-white/60" colSpan={3}>
                    Keine Daten
                  </td>
                </tr>
              ) : (
                oss.items.map((i) => (
                  <tr key={i.country} className="border-b border-white/5">
                    <td className="px-3 py-2">{i.country}</td>
                    <td className="px-3 py-2 text-right">{fmt(i.netBaseCents)}</td>
                    <td className="px-3 py-2 text-right">{fmt(i.vatCents)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 text-xs text-white/70 border-t border-white/10">
          Hinweis: Netto-Umsatz = Domme + Plattformgebühr (ohne VAT). VAT je Land laut Buyer Country (OSS).
        </div>
      </section>

      {/* Evidence Compliance */}
      <section className="rounded-app border border-sub overflow-hidden shadow-app mt-4">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <div className="font-semibold">Evidence-Compliance (≥ 2 Beweise gleiches Land)</div>
          <div className="text-sm text-white/80">
            {evidence ? `${evidence.totals.compliant}/${evidence.totals.total} (${evidence.totals.compliantPct}%)` : '—'}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-white/70">
              <tr className="border-b border-white/10">
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Payment</th>
                <th className="px-3 py-2 text-left">Buyer Country</th>
                <th className="px-3 py-2 text-left">Evidence Types</th>
                <th className="px-3 py-2 text-left">Evidence Countries</th>
                <th className="px-3 py-2 text-left">OK</th>
              </tr>
            </thead>
            <tbody>
              {!evidence?.rows?.length ? (
                <tr>
                  <td colSpan={6} className="px-3 py-3 text-white/60">
                    Keine Transaktionen
                  </td>
                </tr>
              ) : (
                evidence.rows.map((r) => (
                  <tr key={r.id} className="border-b border-white/5">
                    <td className="px-3 py-2">{r.date}</td>
                    <td className="px-3 py-2">{r.id.slice(0, 10)}…</td>
                    <td className="px-3 py-2">{r.buyerCountry}</td>
                    <td className="px-3 py-2">{r.types.join(', ') || '—'}</td>
                    <td className="px-3 py-2">{r.countries.join(', ') || '—'}</td>
                    <td className={`px-3 py-2 ${r.ok ? 'text-green-400' : 'text-red-400'}`}>{r.ok ? 'YES' : 'NO'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 text-xs text-white/70 border-t border-white/10">
          OSS-Regel: mind. 2 unabhängige Evidences (z. B. IP + BIN oder Billing + IP) müssen dasselbe Land bestätigen.
        </div>
      </section>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 p-4">
      <div className="text-xs text-white/70">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
