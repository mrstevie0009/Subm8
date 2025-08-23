// src/app/[locale]/settings/payments/page.tsx
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";

type Params = { locale: string };

function fmtMoney(cents: number, currency: string, locale = "en") {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export default async function PaymentsPage({ params }: { params: Params }) {
  const { locale } = params; // <— kein await hier

  const me = await getCurrentUser().catch(() => null);
  const handle = (me as { handle?: string | null } | null)?.handle ?? "—";

  if (!me) {
    return (
      <section className="rounded-app border border-sub overflow-hidden shadow-app">
        <header className="px-4 pt-3 pb-4 border-b border-white/10">
          <div className="flex items-center">
            <Link
              href={`/${locale}`}
              aria-label="Back to feed"
              className="inline-flex items-center p-1 hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
              style={{ color: "var(--purple)" }}
            >
              <ChevronLeftIcon />
            </Link>
            <div className="ml-2 sm:ml-3">
              <h1 className="text-[22px] font-bold leading-tight">
                Payments &amp; History
              </h1>
              <div className="text-sm text-white/60">@{handle}</div>
            </div>
          </div>
        </header>

        <div className="p-8 text-center text-white/80">
          Please sign in to see your payment history.
        </div>
      </section>
    );
  }

  const tips = await prisma.tip.findMany({
    where: { OR: [{ toUserId: me.id }, { fromUserId: me.id }] },
    include: { from: true, to: true },
    orderBy: { createdAt: "desc" },
  });

  const balanceCents = tips
    .filter((t) => t.toUserId === me.id && t.status === "SUCCEEDED")
    .reduce((acc, t) => acc + t.amountCents, 0);

  const balanceCurrency =
    tips.find((t) => t.toUserId === me.id)?.currency ?? "USD";

  const rows = tips.map((t) => {
    const incoming = t.toUserId === me.id;
    const counterparty = incoming ? t.from : t.to;
    return {
      id: t.id,
      createdAt: t.createdAt,
      counterparty: {
        handle: counterparty.handle,
        displayName: counterparty.displayName ?? null,
        avatarUrl: counterparty.avatarUrl ?? null,
      },
      direction: incoming ? ("in" as const) : ("out" as const),
      amountCents: t.amountCents,
      currency: t.currency,
      what: t.note ?? "Tip",
      status: t.status as "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED",
    };
  });

  const csvUrl = `/api/payments/export?locale=${encodeURIComponent(locale)}`;

  const dtf = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <section className="rounded-app border border-sub overflow-hidden shadow-app">
      {/* Header */}
      <header className="px-4 pt-3 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/${locale}`}
              aria-label="Back to feed"
              className="inline-flex items-center p-1 hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
              style={{ color: "var(--purple)" }}
            >
              <ChevronLeftIcon />
            </Link>
            <div className="ml-2 sm:ml-3">
              <h1 className="text-[22px] font-bold leading-tight">
                Payments &amp; History
              </h1>
              <div className="text-sm text-white/60">@{handle}</div>
            </div>
          </div>

          <button
            type="button"
            className="px-4 py-1.5 rounded-full bg-[var(--purple)] hover:opacity-95 text-white"
            title="Request payout (coming soon)"
          >
            Payout
          </button>
        </div>
      </header>

      {/* Balance-Block */}
      <section className="border-y border-white/10">
        <div className="px-4 py-8 md:py-10 min-h-[50px] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-[17px] font-medium opacity-90 whitespace-nowrap">
              Current Account Balance:
            </div>
            <a
              href={csvUrl}
              className="px-4 py-2 rounded-full bg-[var(--purple)]/90 hover:bg-[var(--purple)] text-white text-[14px] whitespace-nowrap"
            >
              CSV-Export
            </a>
          </div>

          <div className="px-5 py-2 font-semibold whitespace-nowrap text-[15px]">
            {fmtMoney(balanceCents, balanceCurrency, locale)}
          </div>
        </div>
      </section>

      {/* Verlauf – leer vs. Tabelle */}
      {rows.length === 0 ? (
        <div className="grid place-items-center text-center" style={{ minHeight: "50vh" }}>
          <div className="font-bold text-[18px] text-white/85">
            No Payments History
          </div>
        </div>
      ) : (
        <div className="overflow-auto" style={{ maxHeight: "70vh" }}>
          <table className="w-full text-left" style={{ minWidth: 760 }}>
            <thead className="sticky top-0 z-10 bg-black/70 backdrop-blur border-b border-white/10">
              <tr className="[&>th]:py-3 [&>th]:px-4 text-white/80">
                <th style={{ width: 110, minWidth: 110 }}>Avatar</th>
                <th style={{ width: 200, minWidth: 200 }}>Date</th>
                <th style={{ width: 220, minWidth: 220 }}>Username</th>
                <th style={{ width: 180, minWidth: 180 }}>Amount</th>
                <th style={{ width: 200, minWidth: 200 }}>What</th>
                <th style={{ width: 160, minWidth: 160 }}>Status</th>
              </tr>
            </thead>
            <tbody className="[&>tr]:border-b [&>tr]:border-white/10">
              {rows.map((r) => {
                const who = r.counterparty.displayName ?? r.counterparty.handle;
                const amountLabel =
                  r.direction === "in"
                    ? `Received: ${fmtMoney(r.amountCents, r.currency, locale)}`
                    : `Sent: ${fmtMoney(r.amountCents, r.currency, locale)}`;

                const statusTone =
                  r.status === "SUCCEEDED"
                    ? "text-emerald-400"
                    : r.status === "PENDING"
                    ? "text-yellow-300"
                    : r.status === "REFUNDED"
                    ? "text-white/70"
                    : "text-red-400";

                return (
                  <tr key={r.id} className="[&>td]:py-3 [&>td]:px-4 align-middle">
                    <td>
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 border border-white/10">
                        <Image
                          src={
                            r.counterparty.avatarUrl ??
                            "/images/avatar-placeholder.png"
                          }
                          alt={`${who} avatar`}
                          width={40}
                          height={40}
                          className="object-cover w-10 h-10"
                        />
                      </div>
                    </td>
                    <td className="whitespace-nowrap">{dtf.format(r.createdAt)}</td>
                    <td className="whitespace-nowrap">{who}</td>
                    <td className="whitespace-nowrap">{amountLabel}</td>
                    <td className="whitespace-nowrap">{r.what}</td>
                    <td className={`whitespace-nowrap font-medium ${statusTone}`}>
                      {r.status}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ===== Icons ===== */
function ChevronLeftIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
    >
      <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
