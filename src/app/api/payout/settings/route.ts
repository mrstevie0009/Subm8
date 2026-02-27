// src/app/api/payout/settings/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { z } from "zod";

const PayloadSchema = z.object({
  method: z.literal("STRIPE_CONNECT"),
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
        stripeDetailsSubmitted: true,
        stripePayoutsEnabled: true,
        stripeChargesEnabled: true,
        stripeOnboardingLastAt: true,
      },
    });

    return NextResponse.json({
      method: "STRIPE_CONNECT",
      stripe: {
        accountId: u?.stripeAccountId ?? null,
        detailsSubmitted: u?.stripeDetailsSubmitted ?? false,
        payoutsEnabled: u?.stripePayoutsEnabled ?? false,
        chargesEnabled: u?.stripeChargesEnabled ?? false,
        onboardingLastAt: u?.stripeOnboardingLastAt ?? null,
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

    const body = await req.json().catch(() => ({}));
    PayloadSchema.parse(body);

    await prisma.user.update({
      where: { id: me.id },
      data: {
        payoutMethod: "STRIPE_CONNECT",
        // optional: räum alte Felder auf, falls du sie in DB noch hast
        payoutPaxumEmail: null,
        payoutCosmoWalletId: null,
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
