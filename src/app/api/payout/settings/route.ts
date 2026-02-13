//src/app/api/payout/settings/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";

const MethodEnum = z.enum(["STRIPE_CONNECT", "PAXUM", "COSMO"]);

const PayloadSchema = z.object({
  method: MethodEnum,
  // Paxum / Cosmo
  paxumEmail: z.string().email("Ungültige Paxum E-Mail").optional().nullable(),
  cosmoWalletId: z.string().min(4, "Cosmo Wallet ID zu kurz").max(120, "Cosmo Wallet ID zu lang").optional().nullable(),
});

export async function GET() {
  try {
    const me = await getCurrentUser().catch(() => null);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const u = await prisma.user.findUnique({
      where: { id: me.id },
      select: {
        payoutMethod: true,
        stripeAccountId: true,
        payoutPaxumEmail: true,
        payoutCosmoWalletId: true,
      },
    });

    return NextResponse.json({
      method: u?.payoutMethod ?? "STRIPE_CONNECT",
      stripe: {
        accountId: u?.stripeAccountId ?? null,
      },
      paxum: {
        email: u?.payoutPaxumEmail ?? null,
      },
      cosmo: {
        walletId: u?.payoutCosmoWalletId ?? null,
      },
    });
  } catch (e) {
    console.error("GET /api/payout/settings error:", e);
    return NextResponse.json({ error: "Fehler beim Laden" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await getCurrentUser().catch(() => null);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const data = PayloadSchema.parse(body);

    // Methode-spezifische Pflichtfelder
    if (data.method === "PAXUM") {
      if (!data.paxumEmail) return NextResponse.json({ error: "Paxum E-Mail erforderlich" }, { status: 400 });
    }
    if (data.method === "COSMO") {
      if (!data.cosmoWalletId) return NextResponse.json({ error: "Cosmo Wallet ID erforderlich" }, { status: 400 });
    }
    // STRIPE_CONNECT: hier speichern wir nur method; Account-Linking kommt separat.

    await prisma.user.update({
      where: { id: me.id },
      data: {
        payoutMethod: data.method,
        
        payoutPaxumEmail: data.method === "PAXUM" ? data.paxumEmail! : undefined,
        payoutCosmoWalletId: data.method === "COSMO" ? data.cosmoWalletId! : undefined,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Ungültige Daten" }, { status: 400 });
    }
    console.error("POST /api/payout/settings error:", error);
    return NextResponse.json({ error: "Fehler beim Speichern" }, { status: 500 });
  }
}
