// src/app/[locale]/admin/page.tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { assertAdmin, getAdminIdentity } from '@/lib/admin';

type Params = { locale: string };

export const dynamic = 'force-dynamic';

/* ------------------------------- DB Helpers ------------------------------- */

// Legt eine sehr einfache Report-Tabelle an, falls nicht vorhanden.
async function ensureReportTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ContentReport" (
      "id" TEXT PRIMARY KEY,
      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "targetType" TEXT NOT NULL, -- 'POST' | 'USER'
      "targetId" TEXT NOT NULL,
      "reporterUserId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "reason" TEXT,
      "resolvedAt" TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ContentReport_target_idx"
    ON "ContentReport"("targetType","targetId") WHERE "resolvedAt" IS NULL;
  `);
}

/* ----------------------------- Admin Actions ------------------------------ */

export async function deletePostAction(form: FormData) {
  'use server';
  await assertAdmin();
  const postId = String(form.get('postId') ?? '');
  if (!postId) throw new Error('postId missing');

  await prisma.post.delete({ where: { id: postId } }).catch(() => {});
  await prisma.$executeRaw`
    UPDATE "ContentReport" SET "resolvedAt" = NOW()
    WHERE "targetType" = 'POST' AND "targetId" = ${postId} AND "resolvedAt" IS NULL
  `;

  revalidatePath('/[locale]/admin', 'page');
}

export async function deactivateOrDeleteUserAction(form: FormData) {
  'use server';
  await assertAdmin();
  const userId = String(form.get('userId') ?? '');
  if (!userId) throw new Error('userId missing');

  const hasIsDeactivated = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'isDeactivated'
  `;

  if (hasIsDeactivated.length) {
    await prisma.user.update({ where: { id: userId }, data: { isDeactivated: true } }).catch(() => {});
    await prisma.session.deleteMany({ where: { userId } }).catch(() => {});
  } else {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  }

  await prisma.$executeRaw`
    UPDATE "ContentReport" SET "resolvedAt" = NOW()
    WHERE "targetType" = 'USER' AND "targetId" = ${userId} AND "resolvedAt" IS NULL
  `;

  revalidatePath('/[locale]/admin', 'page');
}

export async function resolveReportsAction(form: FormData) {
  'use server';
  await assertAdmin();
  const targetType = String(form.get('targetType') ?? '');
  const targetId = String(form.get('targetId') ?? '');
  if (!targetType || !targetId) throw new Error('missing fields');

  await prisma.$executeRaw`
    UPDATE "ContentReport" SET "resolvedAt" = NOW()
    WHERE "targetType" = ${targetType} AND "targetId" = ${targetId} AND "resolvedAt" IS NULL
  `;
  revalidatePath('/[locale]/admin', 'page');
}

/* ------------------------------ Data Loading ------------------------------ */

type RevenueRow = {
  id: string;
  createdAt: Date;
  status: string;
  payerHandle: string | null;
  payeeHandle: string | null;
  amountGrossCents: number;
  platformFeeCents: number;
  processorFeeCents: number;
  platformNetCents: number;
};

async function loadRevenue(limit = 200): Promise<RevenueRow[]> {
  const rows = await prisma.$queryRaw<RevenueRow[]>`
    SELECT
      p.id,
      p."createdAt",
      p.status,
      u_from."handle"  AS "payerHandle",
      u_to."handle"    AS "payeeHandle",
      p."amountGrossCents",
      p."platformFeeCents",
      p."processorFeeCents",
      (p."platformFeeCents" - p."processorFeeCents") AS "platformNetCents"
    FROM "Payment" p
      LEFT JOIN "User" u_from ON u_from.id = p."payerId"
      LEFT JOIN "User" u_to   ON u_to.id   = p."payeeId"
    ORDER BY p."createdAt" DESC
    LIMIT ${limit}
  `;
  return rows;
}

type ReportAgg = {
  targetId: string;
  count: number;
  firstReportedAt: Date;
  lastReportedAt: Date;
  handleOrSnippet: string | null;
};

async function loadAggregatedReports() {
  await ensureReportTables();

  const postReports = await prisma.$queryRaw<ReportAgg[]>`
    SELECT
      r."targetId",
      COUNT(*)::int AS count,
      MIN(r."createdAt") AS "firstReportedAt",
      MAX(r."createdAt") AS "lastReportedAt",
      ('@' || u."handle" || ': ' || left(p."text", 60)) AS "handleOrSnippet"
    FROM "ContentReport" r
      LEFT JOIN "Post" p ON p.id = r."targetId"
      LEFT JOIN "User" u ON u.id = p."authorId"
    WHERE r."resolvedAt" IS NULL AND r."targetType" = 'POST'
    GROUP BY r."targetId", u."handle", p."text"
    ORDER BY count DESC, "lastReportedAt" DESC
    LIMIT 100
  `;

  const userReports = await prisma.$queryRaw<ReportAgg[]>`
    SELECT
      r."targetId",
      COUNT(*)::int AS count,
      MIN(r."createdAt") AS "firstReportedAt",
      MAX(r."createdAt") AS "lastReportedAt",
      ('@' || u."handle") AS "handleOrSnippet"
    FROM "ContentReport" r
      LEFT JOIN "User" u ON u.id = r."targetId"
    WHERE r."resolvedAt" IS NULL AND r."targetType" = 'USER'
    GROUP BY r."targetId", u."handle"
    ORDER BY count DESC, "lastReportedAt" DESC
    LIMIT 100
  `;

  return { postReports, userReports };
}

async function loadLatestPosts(limit = 30) {
  return prisma.post.findMany({
    orderBy: { createdAt: 'desc' },
    include: { author: { select: { id: true, handle: true, displayName: true } } },
    take: limit,
  });
}

async function loadLatestUsers(limit = 30) {
  return prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, handle: true, displayName: true, email: true },
    take: limit,
  });
}

/* ---------------------------------- Page ---------------------------------- */

export default async function AdminPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params; // <-- Fix: params awaiten

  const admin = await getAdminIdentity();
  if (!admin) {
    // lieber Redirect als 404, damit klar ist, dass Auth fehlt
    redirect(`/${locale}/signin`);
  }

  const [revenue, reports, posts, users] = await Promise.all([
    loadRevenue(200),
    loadAggregatedReports(),
    loadLatestPosts(30),
    loadLatestUsers(30),
  ]);

  const kpis = (() => {
    const gross = revenue.reduce((s, r) => s + (r.amountGrossCents ?? 0), 0);
    const platformGross = revenue.reduce((s, r) => s + (r.platformFeeCents ?? 0), 0);
    const processor = revenue.reduce((s, r) => s + (r.processorFeeCents ?? 0), 0);
    const platformNet = revenue.reduce((s, r) => s + (r.platformNetCents ?? 0), 0);
    return { gross, platformGross, processor, platformNet };
  })();

  return (
    <section className="rounded-xl border border-white/10 overflow-hidden">
      <header className="px-4 pt-3 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Link href={`/${locale}`} className="p-1" aria-label="Zurück">
            <ChevronLeftIcon />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">Admin</h1>
            <p className="text-sm text-white/60">
              Angemeldet als <span className="font-medium">@{admin.handle}</span>
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 p-4">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Gesamt-Umsatz (Brutto)" amountCents={kpis.gross} />
          <KpiCard label="Plattformgebühren (Brutto)" amountCents={kpis.platformGross} />
          <KpiCard label="Processor Fees" amountCents={kpis.processor} />
          <KpiCard label="Plattform-Einnahmen (Netto)" amountCents={kpis.platformNet} />
        </div>

        {/* Einnahmen-Tabelle */}
        <section className="rounded-lg border border-white/10">
          <div className="px-4 py-3 border-b border-white/10">
            <h2 className="text-base font-semibold">Einnahmen</h2>
            <p className="text-xs text-white/50">
              Plattform-Netto = Plattformgebühr − Payment-Provider-Gebühr
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-white/60">
                <tr className="border-b border-white/10">
                  <Th>Datum</Th>
                  <Th>Von → An</Th>
                  <Th className="text-right">Brutto</Th>
                  <Th className="text-right">Plattform</Th>
                  <Th className="text-right">Processor</Th>
                  <Th className="text-right">Plattform (Netto)</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {revenue.map((r) => (
                  <tr key={r.id} className="border-b border-white/5">
                    <Td>{new Date(r.createdAt).toLocaleString()}</Td>
                    <Td>
                      @{r.payerHandle ?? '—'} → @{r.payeeHandle ?? '—'}
                    </Td>
                    <TdRight>{fmtCents(r.amountGrossCents)}</TdRight>
                    <TdRight>{fmtCents(r.platformFeeCents)}</TdRight>
                    <TdRight>{fmtCents(r.processorFeeCents)}</TdRight>
                    <TdRight className={r.platformNetCents < 0 ? 'text-red-300' : ''}>
                      {fmtCents(r.platformNetCents)}
                    </TdRight>
                    <Td>
                      <span className="rounded px-2 py-0.5 text-xs bg-white/10 border border-white/10">
                        {r.status}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Reports */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <ReportCard
            title="Gemeldete Posts"
            rows={reports.postReports}
            resolveName="postId"
            targetType="POST"
            onResolve={resolveReportsAction}
            onDelete={deletePostAction}
            deleteLabel="Post löschen"
          />
          <ReportCard
            title="Gemeldete Nutzer"
            rows={reports.userReports}
            resolveName="userId"
            targetType="USER"
            onResolve={resolveReportsAction}
            onDelete={deactivateOrDeleteUserAction}
            deleteLabel="Nutzer deaktivieren/löschen"
          />
        </div>

        {/* Moderation: Neueste Posts */}
        <section className="rounded-lg border border-white/10 p-4">
          <h2 className="text-base font-semibold mb-3">Neueste Posts</h2>
          <div className="grid gap-2">
            {posts.map((p) => (
              <form key={p.id} action={deletePostAction} className="flex items-center justify-between gap-3 rounded border border-white/10 px-3 py-2">
                <input type="hidden" name="postId" value={p.id} />
                <div className="min-w-0">
                  <p className="text-sm truncate">
                    <span className="text-white/60">@{p.author.handle}:</span> {p.text}
                  </p>
                  <p className="text-xs text-white/50">
                    {new Date(p.createdAt).toLocaleString()}
                  </p>
                </div>
                <button className="text-xs rounded-full border border-red-400/40 text-red-200/90 px-3 py-1 hover:bg-red-500/10">
                  Löschen
                </button>
              </form>
            ))}
          </div>
        </section>

        {/* Moderation: Neueste Nutzer */}
        <section className="rounded-lg border border-white/10 p-4">
          <h2 className="text-base font-semibold mb-3">Neueste Nutzer</h2>
          <div className="grid gap-2">
            {users.map((u) => (
              <form key={u.id} action={deactivateOrDeleteUserAction} className="flex items-center justify-between gap-3 rounded border border-white/10 px-3 py-2">
                <input type="hidden" name="userId" value={u.id} />
                <div className="min-w-0">
                  <p className="text-sm truncate">
                    @{u.handle} <span className="text-white/60">({u.displayName})</span>
                  </p>
                  <p className="text-xs text-white/50">{u.email ?? '—'}</p>
                </div>
                <button className="text-xs rounded-full border border-yellow-400/40 text-yellow-200/90 px-3 py-1 hover:bg-yellow-500/10">
                  Deaktivieren/Löschen
                </button>
              </form>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

/* --------------------------------- UI bits -------------------------------- */

function KpiCard({ label, amountCents }: { label: string; amountCents: number }) {
  return (
    <div className="rounded-lg border border-white/10 p-4">
      <p className="text-xs text-white/60">{label}</p>
      <p className="mt-1 text-xl font-semibold">{fmtCents(amountCents)}</p>
    </div>
  );
}

function ReportCard(props: {
  title: string;
  rows: { targetId: string; count: number; firstReportedAt: Date; lastReportedAt: Date; handleOrSnippet: string | null }[];
  resolveName: string;
  targetType: 'POST' | 'USER';
  onResolve: (form: FormData) => Promise<void>;
  onDelete: (form: FormData) => Promise<void>;
  deleteLabel: string;
}) {
  return (
    <section className="rounded-lg border border-white/10">
      <div className="px-4 py-3 border-b border-white/10">
        <h2 className="text-base font-semibold">{props.title}</h2>
        <p className="text-xs text-white/50">Ungelöste Meldungen, nach Häufigkeit sortiert.</p>
      </div>
      <div className="divide-y divide-white/10">
        {props.rows.length === 0 && <p className="p-4 text-sm text-white/60">Keine Meldungen.</p>}
        {props.rows.map((r) => (
          <div key={r.targetId} className="p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm truncate">{r.handleOrSnippet ?? r.targetId}</p>
              <p className="text-xs text-white/50">
                {r.count} Meldung(en) · zuletzt {new Date(r.lastReportedAt).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <form action={props.onResolve}>
                <input type="hidden" name="targetType" value={props.targetType} />
                <input type="hidden" name="targetId" value={r.targetId} />
                <button className="text-xs rounded-full border border-white/15 px-3 py-1 hover:bg-white/10">
                  Als gelöst markieren
                </button>
              </form>
              <form action={props.onDelete}>
                <input type="hidden" name={props.resolveName} value={r.targetId} />
                <button className="text-xs rounded-full border border-red-400/40 text-red-200/90 px-3 py-1 hover:bg-red-500/10">
                  {props.deleteLabel}
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 text-left font-medium ${className}`}>{children}</th>;
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}
function TdRight({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-right tabular-nums ${className}`}>{children}</td>;
}

function fmtCents(cents: number) {
  const v = (cents ?? 0) / 100;
  return v.toLocaleString(undefined, { style: 'currency', currency: 'EUR' });
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
