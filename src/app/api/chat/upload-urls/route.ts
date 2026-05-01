// src/app/api/chat/upload-urls/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/currentUser';
import { prisma } from '@/lib/prisma';
import { presignPut } from '@/lib/r2sign';

export const runtime = 'nodejs';

const ALLOWED = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime',
  'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg',
]);

export async function POST(req: NextRequest) {
  const me = await getCurrentUser().catch(() => null);
  if (!me) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const conversationId = String(body.conversationId || '');
  const files = Array.isArray(body.files) ? body.files.slice(0, 10) : [];

  if (!conversationId) return NextResponse.json({ ok: false, error: 'Missing conversationId' }, { status: 400 });
  if (!files.length) return NextResponse.json({ ok: false, error: 'No files' }, { status: 400 });

  const convo = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      dommeId: true,
      subId: true,
      type: true,
      members: { where: { userId: me.id }, select: { userId: true } },
    },
  });

  if (!convo) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

  const isMember =
    convo.type === 'DM'
      ? convo.dommeId === me.id || convo.subId === me.id
      : convo.members.length > 0;

  if (!isMember) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });

  try {
    const items = await Promise.all(
      files.map(async (f: { name?: string; type?: string }) => {
        const name = String(f.name || 'file');
        const type = String(f.type || '');
        if (!ALLOWED.has(type)) throw new Error(`File type not allowed: ${type}`);
        const signed = await presignPut('chat-media-private', name, type);
        return { key: signed.key, uploadUrl: signed.uploadUrl, contentType: type };
      })
    );
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Presign failed';
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}