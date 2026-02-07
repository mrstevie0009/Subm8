// src/app/api/payout/sepa/settings/route.ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/currentUser';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const IbanRegex = /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/;
const BicRegex = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

const SepaSettingsSchema = z.object({
  iban: z.string().regex(IbanRegex, 'Ungültige IBAN'),
  accountHolder: z.string().min(2, 'Name zu kurz').max(100, 'Name zu lang'),
  bic: z.string().regex(BicRegex, 'Ungültiger BIC').optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const data = SepaSettingsSchema.parse(body);

    await prisma.user.update({
      where: { id: me.id },
      data: {
        payoutIban: data.iban,
        payoutAccountHolder: data.accountHolder,
        payoutBic: data.bic,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }

    console.error('SEPA settings save error:', error);
    return NextResponse.json({ error: 'Fehler beim Speichern' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const me = await getCurrentUser();
    if (!me) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: me.id },
      select: {
        payoutIban: true,
        payoutAccountHolder: true,
        payoutBic: true,
      },
    });

    return NextResponse.json({
      iban: user?.payoutIban,
      accountHolder: user?.payoutAccountHolder,
      bic: user?.payoutBic,
    });
  } catch (error) {
    console.error('Get SEPA settings error:', error);
    return NextResponse.json({ error: 'Fehler beim Laden' }, { status: 500 });
  }
}