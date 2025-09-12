//src/app/api/payments/export/route.ts
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";

function toCSVRow(values: (string | number | Date | null | undefined)[]) {
  return values
    .map((v) => {
      if (v == null) return "";
      const s = v instanceof Date ? v.toISOString() : String(v);
      const needsQuotes = /[",\n]/.test(s);
      const escaped = s.replace(/"/g, '""');
      return needsQuotes ? `"${escaped}"` : escaped;
    })
    .join(",");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const locale = url.searchParams.get("locale") ?? "en";
  const tz = url.searchParams.get("tz") ?? "UTC";

  const me = await getCurrentUser().catch(() => null);
  if (!me) {
    return new Response("Unauthorized", { status: 401 });
  }

  const tips = await prisma.tip.findMany({
    where: { OR: [{ toUserId: me.id }, { fromUserId: me.id }] },
    include: { from: true, to: true },
    orderBy: { createdAt: "desc" },
  });

  const dtf = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: tz,
  });

  const header = ["Date", "Username", "Direction", "Amount", "Currency", "What", "Status"];
  const rows = tips.map((t) => {
    const incoming = t.toUserId === me.id;
    const other = incoming ? t.from : t.to;
    const who = other.displayName ?? other.handle;
    const dir = incoming ? "Received" : "Sent";
    const date = dtf.format(t.createdAt);
    const amount = (t.amountCents / 100).toFixed(2);
    const what = t.note ?? "Tip";
    return toCSVRow([date, who, dir, amount, t.currency, what, t.status]);
  });

  const csvBody = [toCSVRow(header), ...rows].join("\n");
  const filename = `payments-${new Date().toISOString().slice(0, 10)}.csv`;

  // BOM vorneweg hilft Excel beim UTF-8-Erkennen
  return new Response("\uFEFF" + csvBody, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
