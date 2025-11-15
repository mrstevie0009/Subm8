// src/app/api/chat/group/[id]/avatar/route.ts
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { getStorage, buildKey } from '@/lib/storage';
import { $Enums } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me) {
    return Response.json(
      { ok: false, error: 'Not authenticated' },
      { status: 401 },
    );
  }

  // Mitglied + Rolle prüfen
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: id, userId: me.id } },
    select: { role: true, conversation: { select: { type: true } } },
  });
  if (
    !membership ||
    membership.conversation?.type !== $Enums.ConversationType.GROUP
  ) {
    return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }
  if (membership.role !== 'ADMIN') {
    return Response.json(
      { ok: false, error: 'ADMIN_ONLY' },
      { status: 403 },
    );
  }

  // Datei lesen
  const ct = req.headers.get('content-type') || '';
  if (!ct.includes('multipart/form-data')) {
    return Response.json(
      { ok: false, error: 'Expected multipart/form-data' },
      { status: 400 },
    );
  }
  const form = await req.formData();
  const fileEntry = form.get('file');
  const file =
    fileEntry && typeof fileEntry !== 'string'
      ? (fileEntry as File)
      : null;
  if (!file) {
    return Response.json(
      { ok: false, error: 'No file' },
      { status: 400 },
    );
  }

  // Only images
  const type = file.type || 'application/octet-stream';
  if (!/^image\//.test(type)) {
    return Response.json(
      { ok: false, error: 'Unsupported type' },
      { status: 400 },
    );
  }

  // Upload nach Storage
  const storage = getStorage();

  // Extension aus MIME
  const ext = type.split('/')[1]?.toLowerCase() || 'png';
  const key = buildKey('avatars', `groups/${id}-${Date.now()}.${ext}`);

  const { publicUrl } = await storage.put({
    key,
    data: await file.arrayBuffer(),
    contentType: type,
    cacheControl: 'public, max-age=31536000, immutable',
  });

  // In Conversation speichern
  await prisma.conversation.update({
    where: { id },
    data: { avatarUrl: publicUrl },
  });

  return Response.json({ ok: true, url: publicUrl });
}
