// src/app/api/profile/ownership/apply/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OWNREQ_PREFIX = 'OWNREQ::';

//Struktur der OWNREQ-Nachricht (wie im Chat kodiert)
type OwnReqPayload = {
  avatar?: true;
  banner?: true;
  bio?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  avatarDataUrl?: string;
  bannerDataUrl?: string;
};

function parseOwnReq(text?: string | null): OwnReqPayload | null {
  if (!text || !text.startsWith(OWNREQ_PREFIX)) return null;
  try {
    const obj = JSON.parse(text.slice(OWNREQ_PREFIX.length)) as unknown;
    if (obj && typeof obj === 'object') return obj as OwnReqPayload;
  } catch {}
  return null;
}

type Body = { conversationId?: string; messageId?: string };

export async function POST(req: Request) {
  try {
    //1. Eingeloggter User aus der Session – niemals aus dem Client.
    const me = await getCurrentUser().catch(() => null);
    if (!me) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Nur Referenzen entgegennehmen – keine anzuwendenden Werte!
    const body = (await req.json().catch(() => ({}))) as Body;
    const conversationId = String(body.conversationId || '');
    const messageId = String(body.messageId || '');
    if (!conversationId || !messageId) {
      return NextResponse.json({ ok: false, error: 'Missing references' }, { status: 400 });
    }

    // 3. Conversation laden und Berechtigung prüfen:
    //    - Der eingeloggte User MUSS der Sub dieser Conversation sein.
    const convo = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { id: true, dommeId: true, subId: true },
    });
    if (!convo || !convo.dommeId || !convo.subId) {
      return NextResponse.json({ ok: false, error: 'Conversation not found' }, { status: 404 });
    }
    if (convo.subId !== me.id) {
      // Nur der Sub darf einen Ownership-Request auf SEIN Profil anwenden.
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    // 4. Die referenzierte Nachricht laden und verifizieren:
    //    - Sie gehört zu DIESER Conversation.
    //    - Sie wurde von der DOMME dieser Conversation geschrieben.
    //    - Sie ist wirklich ein OWNREQ.
    const msg = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, conversationId: true, authorId: true, text: true },
    });
    if (!msg || msg.conversationId !== convo.id) {
      return NextResponse.json({ ok: false, error: 'Request not found' }, { status: 404 });
    }
    if (msg.authorId !== convo.dommeId) {
      return NextResponse.json({ ok: false, error: 'Invalid request author' }, { status: 403 });
    }

    const payload = parseOwnReq(msg.text);
    if (!payload) {
      return NextResponse.json({ ok: false, error: 'Not an ownership request' }, { status: 400 });
    }

    // 5. Werte AUSSCHLIESSLICH aus der serverseitig geladenen Nachricht ziehen.
    // Der Client kann hier nichts unterschieben.
    const avatarUrl = payload.avatar ? (payload.avatarUrl ?? payload.avatarDataUrl) : undefined;
    const bannerUrl = payload.banner ? (payload.bannerUrl ?? payload.bannerDataUrl) : undefined;
    const bio = typeof payload.bio === 'string' ? payload.bio.trim().slice(0, 300) : undefined;

    // Nur echte URLs zulassen (keine data:-URLs mehr in die DB schreiben – siehe Hinweis unten)
    const safeAvatar = avatarUrl && /^\/?uploads\//.test(avatarUrl) ? avatarUrl : undefined;
    const safeBanner = bannerUrl && /^\/?uploads\//.test(bannerUrl) ? bannerUrl : undefined;

    if (!safeAvatar && !safeBanner && typeof bio !== 'string') {
      return NextResponse.json({ ok: false, error: 'Nothing to apply' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: me.id }, //Nur das eigene Profil des annehmenden Subs.
      data: {
        ...(safeAvatar ? { avatarUrl: safeAvatar } : {}),
        ...(safeBanner ? { bannerUrl: safeBanner } : {}),
        ...(typeof bio === 'string' ? { bio } : {}),
      },
    });

    return NextResponse.json({
      ok: true,
      avatarUrl: safeAvatar,
      bannerUrl: safeBanner,
      bio,
    });
  } catch (e) {
    console.error('ownership/apply failed', e);
    const msg = e instanceof Error ? e.message : 'Apply failed';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}