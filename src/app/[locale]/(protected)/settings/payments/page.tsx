// src/app/[locale]/(protected)/settings/payments/page.tsx
import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { cancelAutodrainAction } from "@/app/actions/autodrain";
import { createTranslator } from "next-intl";
import { notFound } from "next/navigation";
import PayoutButton from "@/components/PayoutButton";
import PayoutBalances from "@/components/PayoutBalances";

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

export default async function PaymentsPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;

  let t: ReturnType<typeof createTranslator>;
  try {
    const paymentFile = (await import(`@/messages/${locale}/payments.json`)).default;
    const messages = { payment: paymentFile };
    t = createTranslator({ locale, messages, namespace: "payment" });
  } catch {
    notFound();
  }

  const cadenceLabel = (c: AutoDrainCadence) =>
    c === "DAILY"
      ? t("paymentsPage.autodrain.cadence.daily")
      : c === "WEEKLY"
      ? t("paymentsPage.autodrain.cadence.weekly")
      : t("paymentsPage.autodrain.cadence.monthly");

  const me = await getCurrentUser().catch(() => null);
  const handle = (me as { handle?: string | null } | null)?.handle ?? "—";

  if (!me) {
    return (
      <section className="rounded-app border border-sub overflow-hidden shadow-app">
        <header className="px-4 pt-3 pb-4 border-b border-white/10">
          <div className="flex items-center">
            <Link
              href={`/${locale}`}
              aria-label={t("paymentsPage.ariaBack")}
              className="inline-flex items-center p-1 hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
              style={{ color: "var(--purple)" }}
            >
              <ChevronLeftIcon />
            </Link>
            <div className="ml-2 sm:ml-3">
              <h1 className="text-[22px] font-bold leading-tight">{t("paymentsPage.title")}</h1>
              <div className="text-sm text-white/60">@{handle}</div>
            </div>
          </div>
        </header>

        <div className="p-8 text-center text-white/80">{t("paymentsPage.guestNote")}</div>
      </section>
    );
  }

  const payments = await prisma.payment.findMany({
    where: { OR: [{ payeeId: me.id }, { payerId: me.id }] },
    include: {
      User_Payment_payerIdToUser: { select: { handle: true, displayName: true, avatarUrl: true } },
      User_Payment_payeeIdToUser: { select: { handle: true, displayName: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Earned (DB) - calculate available balance
  const availablePayments = payments.filter(
    (p) => p.payeeId === me.id && p.status === "SUCCEEDED" && !p.payoutRequestId
  );

  const balanceCents = availablePayments.reduce((acc, p) => acc + (p.amountNetToDommeCents || 0), 0);

  const balanceCurrency = payments.find((p) => p.payeeId === me.id)?.currency ?? "EUR";

  // Fetch SEPA settings
  const payoutSettings = await prisma.user.findUnique({
    where: { id: me.id },
    select: {
      payoutMethod: true,
      stripeAccountId: true,
      payoutPaxumEmail: true,
      payoutCosmoWalletId: true,
    },
  });

  const methodLabel =
  payoutSettings?.payoutMethod === "STRIPE_CONNECT"
    ? "Auszahlbar (Stripe)"
    : payoutSettings?.payoutMethod === "PAXUM"
    ? "Auszahlbar (Paxum)"
    : payoutSettings?.payoutMethod === "COSMO"
    ? "Auszahlbar (Cosmo)"
    : "Auszahlbar (SEPA)";

  const rows = payments.map((p) => {
    const incoming = p.payeeId === me.id;
    const counterparty = incoming ? p.User_Payment_payerIdToUser : p.User_Payment_payeeIdToUser;
    const meta = parseMeta(p.metadataJson);
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
      what: meta.note ?? t("paymentsPage.payments.what.tip"),
      status: p.status as "CREATED" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELED",
    };
  });

  const receivedRows = rows.filter((r) => r.direction === "in");
  const sentRows = rows.filter((r) => r.direction === "out");

  const outgoingSubs = await prisma.autoDrainSubscription.findMany({
    where: { subId: me.id, active: true },
    select: {
      id: true,
      dommeId: true,
      amountCents: true,
      currency: true,
      cadence: true,
      nextChargeAt: true,
      stripeSubscriptionId: true,
      stripeStatus: true,
    },
    orderBy: { nextChargeAt: "asc" },
  });

  const incomingSubs = await prisma.autoDrainSubscription.findMany({
    where: { dommeId: me.id, active: true },
    select: { id: true, subId: true, amountCents: true, currency: true, cadence: true, nextChargeAt: true },
    orderBy: { nextChargeAt: "asc" },
  });

  const counterpartIds = Array.from(
    new Set([...outgoingSubs.map((s) => s.dommeId), ...incomingSubs.map((s) => s.subId)])
  );
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
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href={`/${locale}`}
              aria-label={t("paymentsPage.ariaBack")}
              className="inline-flex items-center p-1 hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
              style={{ color: "var(--purple)" }}
            >
              <ChevronLeftIcon />
            </Link>
            <div className="ml-2 sm:ml-3 min-w-0">
              <h1 className="text-[22px] font-bold leading-tight truncate">{t("paymentsPage.title")}</h1>
              <div className="text-sm text-white/60 truncate">@{handle}</div>
            </div>
          </div>

          <div className="shrink-0">
            <PayoutButton
              availableCents={balanceCents}
              locale={locale}
              tPayoutButton={t("paymentsPage.payoutBtn")}
            />
          </div>
        </div>
      </header>

      {/* Balance (Earned DB + Available Stripe) */}
      <PayoutBalances
        earnedCents={balanceCents}
        earnedCurrency={balanceCurrency}
        csvUrl={csvUrl}
        tBalanceTitle={t("paymentsPage.balance.title")}
        tExportLabel={t("paymentsPage.balance.export")}
        tEarnedLabel={methodLabel}
        tPendingLabel={"Pending"}
        tPendingHint={"Noch in Verarbeitung – wird später auszahlbar."}
      />

      {/* Active Autodrain */}
      <section className="px-4 py-6 border-b border-white/10">
        <h2 className="text-[18px] font-semibold mb-3">{t("paymentsPage.autodrain.title")}</h2>

        {/* Enabled by you */}
        <div className="mb-6">
          <div className="text-[13px] text-white/70 mb-2">{t("paymentsPage.autodrain.outgoing.title")}</div>
          {outgoingSubs.length === 0 ? (
            <div className="text-white/60 text-sm">{t("paymentsPage.autodrain.none")}</div>
          ) : (
            <div className="overflow-auto" style={{ maxHeight: 360 }}>
              <table className="w-full text-left" style={{ minWidth: 720 }}>
                <thead className="sticky top-0 z-10 bg-black/70 backdrop-blur border-b border-white/10">
                  <tr className="[&>th]:py-2.5 [&>th]:px-3 text-white/80">
                    <th style={{ width: 98 }}>{t("paymentsPage.autodrain.th.avatar")}</th>
                    <th style={{ width: 220 }}>{t("paymentsPage.autodrain.th.domme")}</th>
                    <th style={{ width: 180 }}>{t("paymentsPage.autodrain.th.amount")}</th>
                    <th style={{ width: 180 }}>{t("paymentsPage.autodrain.th.cadence")}</th>
                    <th style={{ width: 220 }}>{t("paymentsPage.autodrain.th.next")}</th>
                    <th style={{ width: 160 }} />
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
                              alt={t("paymentsPage.avatarAlt", { name: who })}
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
                              disabled={!s.stripeSubscriptionId}
                              className={`px-3 py-1.5 rounded-lg border text-[13px] ${
                                s.stripeSubscriptionId ? "border-white/20 hover:bg-white/10" : "border-white/10 opacity-60 cursor-not-allowed"
                              }`}
                              title={!s.stripeSubscriptionId ? "Stripe Subscription noch nicht vorhanden (pending)" : undefined}
                            >
                              {t("paymentsPage.autodrain.cancel")}
                            </button>
                          </form>

                          {!s.stripeSubscriptionId ? (
                            <div className="mt-1 text-[11px] text-white/50">Pending…</div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Paying you */}
        <div>
          <h2 className="text-[18px] font-semibold mb-3">{t("paymentsPage.autodrain.incoming.title")}</h2>
          {incomingSubs.length === 0 ? (
            <div className="text-white/60 text-sm">{t("paymentsPage.autodrain.none")}</div>
          ) : (
            <div className="overflow-auto" style={{ maxHeight: 360 }}>
              <table className="w-full text-left" style={{ minWidth: 720 }}>
                <thead className="sticky top-0 z-10 bg-black/70 backdrop-blur border-b border-white/10">
                  <tr className="[&>th]:py-2.5 [&>th]:px-3 text-white/80">
                    <th style={{ width: 98 }}>{t("paymentsPage.autodrain.th.avatar")}</th>
                    <th style={{ width: 220 }}>{t("paymentsPage.autodrain.th.sub")}</th>
                    <th style={{ width: 180 }}>{t("paymentsPage.autodrain.th.amount")}</th>
                    <th style={{ width: 180 }}>{t("paymentsPage.autodrain.th.cadence")}</th>
                    <th style={{ width: 220 }}>{t("paymentsPage.autodrain.th.next")}</th>
                    <th style={{ width: 160 }} />
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
                              alt={t("paymentsPage.avatarAlt", { name: who })}
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
                        <td />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Received */}
      <section className="px-4 py-6 border-b border-white/10">
        <h2 className="text-[18px] font-semibold mb-3">{t("paymentsPage.payments.received.title")}</h2>
        {receivedRows.length === 0 ? (
          <div className="text-white/60 text-sm">{t("paymentsPage.payments.received.empty")}</div>
        ) : (
          <div className="overflow-auto" style={{ maxHeight: "60vh" }}>
            <table className="w-full text-left" style={{ minWidth: 760 }}>
              <thead className="sticky top-0 z-10 bg-black/70 backdrop-blur border-b border-white/10">
                <tr className="[&>th]:py-3 [&>th]:px-4 text-white/80">
                  <th style={{ width: 110, minWidth: 110 }}>{t("paymentsPage.payments.th.avatar")}</th>
                  <th style={{ width: 200, minWidth: 200 }}>{t("paymentsPage.payments.th.date")}</th>
                  <th style={{ width: 220, minWidth: 220 }}>{t("paymentsPage.payments.th.username")}</th>
                  <th style={{ width: 180, minWidth: 180 }}>{t("paymentsPage.payments.th.amount")}</th>
                  <th style={{ width: 200, minWidth: 200 }}>{t("paymentsPage.payments.th.what")}</th>
                  <th style={{ width: 160, minWidth: 160 }}>{t("paymentsPage.payments.th.status")}</th>
                </tr>
              </thead>
              <tbody className="[&>tr]:border-b [&>tr]:border-white/10">
                {receivedRows.map((r) => {
                  const who = r.counterparty.displayName ?? r.counterparty.handle;
                  const amountLabel = t("paymentsPage.payments.amountPrefixReceived", {
                    amount: fmtMoney(r.amountCents, r.currency, locale),
                  });
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
                            alt={t("paymentsPage.avatarAlt", { name: who })}
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
                        {t(
                          `paymentsPage.payments.status.${
                            r.status.toLowerCase() as "created" | "processing" | "succeeded" | "failed" | "canceled"
                          }`
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Sent */}
      <section className="px-4 py-6">
        <h2 className="text-[18px] font-semibold mb-3">{t("paymentsPage.payments.sent.title")}</h2>
        {sentRows.length === 0 ? (
          <div className="text-white/60 text-sm">{t("paymentsPage.payments.sent.empty")}</div>
        ) : (
          <div className="overflow-auto" style={{ maxHeight: "60vh" }}>
            <table className="w-full text-left" style={{ minWidth: 760 }}>
              <thead className="sticky top-0 z-10 bg-black/70 backdrop-blur border-b border-white/10">
                <tr className="[&>th]:py-3 [&>th]:px-4 text-white/80">
                  <th style={{ width: 110, minWidth: 110 }}>{t("paymentsPage.payments.th.avatar")}</th>
                  <th style={{ width: 200, minWidth: 200 }}>{t("paymentsPage.payments.th.date")}</th>
                  <th style={{ width: 220, minWidth: 220 }}>{t("paymentsPage.payments.th.username")}</th>
                  <th style={{ width: 180, minWidth: 180 }}>{t("paymentsPage.payments.th.amount")}</th>
                  <th style={{ width: 200, minWidth: 200 }}>{t("paymentsPage.payments.th.what")}</th>
                  <th style={{ width: 160, minWidth: 160 }}>{t("paymentsPage.payments.th.status")}</th>
                </tr>
              </thead>
              <tbody className="[&>tr]:border-b [&>tr]:border-white/10">
                {sentRows.map((r) => {
                  const who = r.counterparty.displayName ?? r.counterparty.handle;
                  const amountLabel = t("paymentsPage.payments.amountPrefixSent", {
                    amount: fmtMoney(r.amountCents, r.currency, locale),
                  });
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
                            alt={t("paymentsPage.avatarAlt", { name: who })}
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
                        {t(
                          `paymentsPage.payments.status.${
                            r.status.toLowerCase() as "created" | "processing" | "succeeded" | "failed" | "canceled"
                          }`
                        )}
                      </td>
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