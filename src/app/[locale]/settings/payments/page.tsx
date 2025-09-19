// src/app/[locale]/settings/payments/page.tsx
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { cancelAutodrainAction } from "@/app/actions/autodrain"; // ← keeps cancel per-sub working

type Params = { locale: string };

function fmtMoney(cents: number, currency: string, locale = "en") {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format((cents || 0) / 100);
  } catch {
    return `${((cents || 0) / 100).toFixed(2)} ${currency}`;
  }
}

type PaymentMeta = { note?: string | null };
function parseMeta(input: unknown): PaymentMeta {
  if (!input || typeof input !== "object") return {};
  const obj = input as Record<string, unknown>;
  const note = obj.note;
  return { note: typeof note === "string" ? note : note === null ? null : undefined };
}

type AutoDrainCadence = "DAILY" | "WEEKLY" | "MONTHLY";
const cadenceLabel = (c: AutoDrainCadence) => (c === "DAILY" ? "Daily" : c === "WEEKLY" ? "Weekly" : "Monthly");

export default async function PaymentsPage({ params }: { params: Promise<Params> }) {
  // params is a promise in your setup
  const { locale } = await params;

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
              <h1 className="text-[22px] font-bold leading-tight">Payments &amp; History</h1>
              <div className="text-sm text-white/60">@{handle}</div>
            </div>
          </div>
        </header>

        <div className="p-8 text-center text-white/80">Please sign in to see your payment history.</div>
      </section>
    );
  }

  // Read payments (not tips), so net/gross are correct
  const payments = await prisma.payment.findMany({
    where: { OR: [{ payeeId: me.id }, { payerId: me.id }] },
    include: {
      User_Payment_payerIdToUser: { select: { handle: true, displayName: true, avatarUrl: true } },
      User_Payment_payeeIdToUser: { select: { handle: true, displayName: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Domme balance = NET of incoming SUCCEEDED payments
  const balanceCents = payments
    .filter((p) => p.payeeId === me.id && p.status === "SUCCEEDED")
    .reduce((acc, p) => acc + (p.amountNetToDommeCents || 0), 0);

  const balanceCurrency = payments.find((p) => p.payeeId === me.id)?.currency ?? "EUR";

  const rows = payments.map((p) => {
    const incoming = p.payeeId === me.id;
    const counterparty = incoming ? p.User_Payment_payerIdToUser : p.User_Payment_payeeIdToUser;
    const meta = parseMeta(p.metadataJson);
    // incoming = NET (Domme), outgoing = GROSS (Sub)
    const amountCents = incoming ? p.amountNetToDommeCents : p.amountGrossCents;

    return {
      id: p.id,
      createdAt: p.createdAt,
      counterparty: {
        handle: counterparty?.handle ?? "—",
        displayName: counterparty?.displayName ?? null,
        avatarUrl: counterparty?.avatarUrl ?? null,
      },
      direction: incoming ? ("in" as const) : ("out" as const),
      amountCents,
      currency: p.currency,
      what: meta.note ?? "Tip",
      status: p.status as "CREATED" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELED",
    };
  });

  // Split into two views for clearer structure
  const receivedRows = rows.filter((r) => r.direction === "in");
  const sentRows = rows.filter((r) => r.direction === "out");

  // Active Autodrain subs
  const outgoingSubs = await prisma.autoDrainSubscription.findMany({
    where: { subId: me.id, active: true },
    select: { id: true, dommeId: true, amountCents: true, currency: true, cadence: true, nextChargeAt: true },
    orderBy: { nextChargeAt: "asc" },
  });

  const incomingSubs = await prisma.autoDrainSubscription.findMany({
    where: { dommeId: me.id, active: true },
    select: { id: true, subId: true, amountCents: true, currency: true, cadence: true, nextChargeAt: true },
    orderBy: { nextChargeAt: "asc" },
  });

  const counterpartIds = Array.from(new Set([...outgoingSubs.map((s) => s.dommeId), ...incomingSubs.map((s) => s.subId)]));
  const counterparts =
    counterpartIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: counterpartIds } },
          select: { id: true, handle: true, displayName: true, avatarUrl: true },
        })
      : [];
  const byId = new Map(counterparts.map((u) => [u.id, u]));

  const csvUrl = `/api/payments/export?locale=${encodeURIComponent(locale)}`;
  const dtf = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

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
              <h1 className="text-[22px] font-bold leading-tight">Payments &amp; History</h1>
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

      {/* Balance */}
      <section className="border-y border-white/10">
        <div className="px-4 py-8 md:py-10 min-h-[50px] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-[17px] font-medium opacity-90 whitespace-nowrap">Current Account Balance:</div>
            <a href={csvUrl} className="px-4 py-2 rounded-full bg-[var(--purple)]/90 hover:bg-[var(--purple)] text-white text-[14px] whitespace-nowrap">
              CSV-Export
            </a>
          </div>

          <div className="px-5 py-2 font-semibold whitespace-nowrap text-[15px]">
            {fmtMoney(balanceCents, balanceCurrency, locale)}
          </div>
        </div>
      </section>

      {/* Active Autodrain */}
      <section className="px-4 py-6 border-b border-white/10">
        <h2 className="text-[18px] font-semibold mb-3">Active Autodrain</h2>

        {/* Enabled by you (you are Sub) */}
        <div className="mb-6">
          <div className="text-[13px] text-white/70 mb-2">Enabled by you</div>
          {outgoingSubs.length === 0 ? (
            <div className="text-white/60 text-sm">No active subscriptions.</div>
          ) : (
            <div className="overflow-auto" style={{ maxHeight: 360 }}>
              <table className="w-full text-left" style={{ minWidth: 720 }}>
                <thead className="sticky top-0 z-10 bg-black/70 backdrop-blur border-b border-white/10">
                  <tr className="[&>th]:py-2.5 [&>th]:px-3 text-white/80">
                    <th style={{ width: 98 }}>Avatar</th>
                    <th style={{ width: 220 }}>Domme</th>
                    <th style={{ width: 180 }}>Amount</th>
                    <th style={{ width: 180 }}>Cadence</th>
                    <th style={{ width: 220 }}>Next charge</th>
                    <th style={{ width: 160 }}></th>
                  </tr>
                </thead>
                <tbody className="[&>tr]:border-b [&>tr]:border-white/10">
                  {outgoingSubs.map((s) => {
                    const u = byId.get(s.dommeId);
                    const who = u?.displayName ?? u?.handle ?? "—";
                    return (
                      <tr key={s.id} className="[&>td]:py-2.5 [&>td]:px-3 align-middle">
                        <td>
                          <div className="w-9 h-9 rounded-full overflow-hidden bg-white/10 border border-white/10">
                            <Image
                              src={u?.avatarUrl ?? "/images/avatar-placeholder.png"}
                              alt={`${who} avatar`}
                              width={36}
                              height={36}
                              className="object-cover w-9 h-9"
                            />
                          </div>
                        </td>
                        <td className="whitespace-nowrap">{who}</td>
                        <td className="whitespace-nowrap">{fmtMoney(s.amountCents, s.currency, locale)}</td>
                        <td className="whitespace-nowrap">{cadenceLabel(s.cadence as AutoDrainCadence)}</td>
                        <td className="whitespace-nowrap">{s.nextChargeAt ? dtf.format(s.nextChargeAt) : "—"}</td>
                        <td className="whitespace-nowrap">
                          <form action={cancelAutodrainAction}>
                            <input type="hidden" name="id" value={s.id} />
                            <input type="hidden" name="locale" value={locale} />
                            <button
                              type="submit"
                              className="px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/10 text-[13px]"
                            >
                              Cancel
                            </button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Paying you*/}
        <div>
          <h2 className="text-[18px] font-semibold mb-3">Receiving Autodrain</h2>
          {incomingSubs.length === 0 ? (
            <div className="text-white/60 text-sm">No active subscriptions.</div>
          ) : (
            <div className="overflow-auto" style={{ maxHeight: 360 }}>
              <table className="w-full text-left" style={{ minWidth: 720 }}>
                <thead className="sticky top-0 z-10 bg-black/70 backdrop-blur border-b border-white/10">
                  <tr className="[&>th]:py-2.5 [&>th]:px-3 text-white/80">
                    <th style={{ width: 98 }}>Avatar</th>
                    <th style={{ width: 220 }}>Sub</th>
                    <th style={{ width: 180 }}>Amount</th>
                    <th style={{ width: 180 }}>Cadence</th>
                    <th style={{ width: 220 }}>Next charge</th>
                    <th style={{ width: 160 }}></th>
                  </tr>
                </thead>
                <tbody className="[&>tr]:border-b [&>tr]:border-white/10">
                  {incomingSubs.map((s) => {
                    const u = byId.get(s.subId);
                    const who = u?.displayName ?? u?.handle ?? "—";
                    return (
                      <tr key={s.id} className="[&>td]:py-2.5 [&>td]:px-3 align-middle">
                        <td>
                          <div className="w-9 h-9 rounded-full overflow-hidden bg-white/10 border border-white/10">
                            <Image
                              src={u?.avatarUrl ?? "/images/avatar-placeholder.png"}
                              alt={`${who} avatar`}
                              width={36}
                              height={36}
                              className="object-cover w-9 h-9"
                            />
                          </div>
                        </td>
                        <td className="whitespace-nowrap">{who}</td>
                        <td className="whitespace-nowrap">{fmtMoney(s.amountCents, s.currency, locale)}</td>
                        <td className="whitespace-nowrap">{cadenceLabel(s.cadence as AutoDrainCadence)}</td>
                        <td className="whitespace-nowrap">{s.nextChargeAt ? dtf.format(s.nextChargeAt) : "—"}</td>
                        <td /> {/* Domme doesn't cancel here */}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Sends (incoming payments) */}
      <section className="px-4 py-6 border-b border-white/10">
        <h2 className="text-[18px] font-semibold mb-3">Sends</h2>
        {receivedRows.length === 0 ? (
          <div className="text-white/60 text-sm">No received payments.</div>
        ) : (
          <div className="overflow-auto" style={{ maxHeight: "60vh" }}>
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
                {receivedRows.map((r) => {
                  const who = r.counterparty.displayName ?? r.counterparty.handle;
                  const amountLabel = `Received: ${fmtMoney(r.amountCents, r.currency, locale)}`;
                  const statusTone =
                    r.status === "SUCCEEDED"
                      ? "text-emerald-400"
                      : r.status === "CREATED" || r.status === "PROCESSING"
                      ? "text-yellow-300"
                      : r.status === "FAILED"
                      ? "text-red-400"
                      : "text-white/70";

                  return (
                    <tr key={r.id} className="[&>td]:py-3 [&>td]:px-4 align-middle">
                      <td>
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 border border-white/10">
                          <Image
                            src={r.counterparty.avatarUrl ?? "/images/avatar-placeholder.png"}
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
                      <td className={`whitespace-nowrap font-medium ${statusTone}`}>{r.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* You Sent (outgoing payments) */}
      <section className="px-4 py-6">
        <h2 className="text-[18px] font-semibold mb-3">You Sent</h2>
        {sentRows.length === 0 ? (
          <div className="text-white/60 text-sm">No outgoing payments.</div>
        ) : (
          <div className="overflow-auto" style={{ maxHeight: "60vh" }}>
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
                {sentRows.map((r) => {
                  const who = r.counterparty.displayName ?? r.counterparty.handle;
                  const amountLabel = `Sent: ${fmtMoney(r.amountCents, r.currency, locale)}`;
                  const statusTone =
                    r.status === "SUCCEEDED"
                      ? "text-emerald-400"
                      : r.status === "CREATED" || r.status === "PROCESSING"
                      ? "text-yellow-300"
                      : r.status === "FAILED"
                      ? "text-red-400"
                      : "text-white/70";

                  return (
                    <tr key={r.id} className="[&>td]:py-3 [&>td]:px-4 align-middle">
                      <td>
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-white/10 border border-white/10">
                          <Image
                            src={r.counterparty.avatarUrl ?? "/images/avatar-placeholder.png"}
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
                      <td className={`whitespace-nowrap font-medium ${statusTone}`}>{r.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
