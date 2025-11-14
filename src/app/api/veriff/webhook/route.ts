// src/app/api/veriff/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

const SECRET = process.env.VERIFF_WEBHOOK_SECRET!;
const FAKE_MODE = process.env.VERIFF_FAKE_MODE === 'true';

function verifySignature(req: NextRequest, raw: string) {
  const sig = req.headers.get('x-hmac-signature');
  if (process.env.NODE_ENV !== 'production') {
    if (!sig || !SECRET) return true;
  }
  if (!sig || !SECRET) return false;

  const expected = crypto.createHmac('sha256', SECRET).update(raw).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

function calcAge(dobIso?: string): number | null {
  if (!dobIso) return null;
  const dob = new Date(dobIso);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

export async function POST(req: NextRequest) {
  // Im Fake-Mode ignorieren wir Webhooks einfach
  if (FAKE_MODE) {
    console.log('🔧 VERIFF_FAKE_MODE: ignoring webhook payload');
    return NextResponse.json({ ok: true, fake: true });
  }

  const raw = await req.text();
  if (!verifySignature(req, raw)) {
    return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  }

  const event = JSON.parse(raw);
  const d = event?.verification ?? event?.review ?? event;

  const userId = String(d?.vendorData ?? '');
  const dob = d?.person?.dateOfBirth ?? d?.person?.dob ?? null;

  const decisionRaw =
    (typeof d?.decision === 'string' ? d.decision : d?.decision?.decision) ??
    d?.status ??
    '';
  const decision = String(decisionRaw).toLowerCase();

  let ageOk = false;
  if (decision === 'approved') {
    const age = calcAge(dob ?? undefined);
    ageOk = age == null ? true : age >= 18;
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          ageVerified: ageOk,
          dob: dob ? new Date(dob) : null,
          verifiedAt: new Date(),
        },
      });

      if (ageOk) {
        const verifiedAtNow = new Date();
        await prisma.user.updateMany({
          where: { verifiedByUserId: userId },
          data: {
            ageVerified: true,
            verifiedAt: verifiedAtNow,
            dob: dob ? new Date(dob) : null,
          },
        });
      }
    } catch (e) {
      console.error('❌ DB-Update ageVerified fehlgeschlagen:', e);
    }
  } else {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { ageVerified: false },
      });
    } catch (e) {
      console.error('❌ DB-Update ageVerified=false fehlgeschlagen:', e);
    }
  }

  console.log('✅ Veriff Webhook', {
    userId,
    decision,
    dob,
    ageOk,
  });

  return NextResponse.json({ ok: true, userId, decision, ageOk });
}
