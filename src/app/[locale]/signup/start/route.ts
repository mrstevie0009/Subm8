// src/app/api/signup/start/route.ts
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
try {
const body = (await req.json()) as { handle?: string; role?: 'DOMME' | 'SUBMISSIVE' };
const raw = String(body?.handle ?? '').toLowerCase();
const ok = /^[a-z0-9_]{3,20}$/.test(raw);
if (!ok) return Response.json({ ok: false, error: 'invalid_handle' }, { status: 400 });


const exists = await prisma.user.findFirst({
where: { handle: { equals: raw, mode: 'insensitive' } },
select: { id: true },
});
if (exists) return Response.json({ ok: false, error: 'handle_taken' }, { status: 409 });


// kein DB‑Write nötig – eigentliche Erstellung passiert in /signup/complete
return Response.json({ ok: true });
} catch (err) {
  if (process.env.NODE_ENV !== 'production') {
    console.error('POST /signup/start failed:', err);
  }
  return Response.json({ ok: false, error: 'bad_request' }, { status: 400 });
}
}