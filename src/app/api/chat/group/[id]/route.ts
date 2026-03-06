// src/app/api/chat/group/[id]/route.ts
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { getStorage, buildKey } from '@/lib/storage';
import { ConversationType } from '@prisma/client';

export const dynamic = 'force-dynamic';

/* ------------ Upload Guards & Limits (gleich wie DM) ------------ */
const MAX_UPLOAD_MB = Number(process.env.CHAT_UPLOAD_MAX_MB || '100');
const MAX_TEXT = 4000;
const MAX_ENVELOPE_TEXT = 16000;
const ENVELOPE_RE = /^(REPLY|TIPREQ|TIPPAID|ADREQ|ADACC|OWNREQ|OWNACC|REACT)::/;

function isAllowedMime(type: string) {
  return /^image\//.test(type) || /^video\//.test(type) || /^audio\//.test(type);
}

/* ---- Cursor Helpers (wie DM) ---- */
function encodeCursor(d: Date, id: string) {
  return `${d.getTime()}_${id}`;
}
function decodeCursor(s: string | null) {
  if (!s) return null;
  const [ms, id] = s.split('_');
  const t = Number(ms);
  if (!Number.isFinite(t) || !id) return null;
  return { at: new Date(t), id };
}

/* ------------------------------- GET -------------------------------- */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const me = await getCurrentUser();
    if (!me) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

    const url = new URL(req.url);
    const latestParam = url.searchParams.get('latest') === '1';
    const beforeParam = decodeCursor(url.searchParams.get('before'));
    const sinceParam = decodeCursor(url.searchParams.get('since'));
    const take = Math.min(
      Math.max(Number(url.searchParams.get('take') || (latestParam ? 30 : 200)), 1),
      100,
    );

    // ✅ PARALLEL: Profil + Conversation + Typing laden
    const [meProfile, convo, typingRows] = await Promise.all([
      prisma.user.findUnique({
        where: { id: me.id },
        select: { avatarUrl: true, role: true },
      }),
      prisma.conversation.findUnique({
        where: { id },
        select: {
          id: true,
          type: true,
          title: true,
          avatarUrl: true,
          members: {
            select: {
              userId: true,
              role: true,
              user: {
                select: {
                  id: true,
                  handle: true,
                  displayName: true,
                  avatarUrl: true,
                  role: true,
                },
              },
            },
          },
        },
      }),
      // Typing parallel laden
      prisma.conversationTypingState.findMany({
        where: { 
          conversationId: id, 
          updatedAt: { gt: new Date(Date.now() - 8000) } 
        },
        select: { userId: true },
      }),
    ]);

    if (!convo) return Response.json({ ok: false, error: 'Not found' }, { status: 404 });
    if (convo.type !== ConversationType.GROUP) {
      return Response.json({ ok: false, error: 'NOT_A_GROUP' }, { status: 400 });
    }

    const isMember = convo.members.some((m) => m.userId === me.id);
    if (!isMember) return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });

    const meAvatarUrl =
      meProfile?.avatarUrl && meProfile.avatarUrl.trim()
        ? meProfile.avatarUrl
        : null;

    const baseSelect = {
      id: true,
      createdAt: true,
      authorId: true,
      text: true,
      mediaUrl: true,
      mediaType: true,
    } as const;

    const baseWhere = { conversationId: id } as const;

    // ✅ Cursor-basierte Pagination (wie DM)
    type MessageRow = {
      id: string;
      createdAt: Date;
      authorId: string;
      text: string | null;
      mediaUrl: string | null;
      mediaType: string | null;
    };

    let messagesDb: MessageRow[] = [];

    if (latestParam) {
      const rows = await prisma.message.findMany({
        where: baseWhere,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take,
        select: baseSelect,
      });
      messagesDb = rows.reverse();
    } else if (beforeParam) {
      const rows = await prisma.message.findMany({
        where: {
          ...baseWhere,
          OR: [
            { createdAt: { lt: beforeParam.at } },
            { createdAt: beforeParam.at, id: { lt: beforeParam.id } },
          ],
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take,
        select: baseSelect,
      });
      messagesDb = rows.reverse();
    } else if (sinceParam) {
      messagesDb = await prisma.message.findMany({
        where: {
          ...baseWhere,
          OR: [
            { createdAt: { gt: sinceParam.at } },
            { createdAt: sinceParam.at, id: { gt: sinceParam.id } },
          ],
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take,
        select: baseSelect,
      });
    } else {
      const rows = await prisma.message.findMany({
        where: baseWhere,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take,
        select: baseSelect,
      });
      messagesDb = rows.reverse();
    }

    // ✅ Cursors berechnen
    let olderCursor: string | null = null;
    if (messagesDb.length && (latestParam || beforeParam || (!latestParam && !beforeParam && !sinceParam))) {
      const first = messagesDb[0];
      const older = await prisma.message.findFirst({
        where: {
          ...baseWhere,
          OR: [
            { createdAt: { lt: first.createdAt } },
            { createdAt: first.createdAt, id: { lt: first.id } },
          ],
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { id: true, createdAt: true },
      });
      olderCursor = older ? encodeCursor(older.createdAt, older.id) : null;
    }

    const mapped = messagesDb.map((m) => ({
      id: m.id,
      at: m.createdAt.toISOString(),
      authorId: m.authorId,
      text: m.text,
      mediaUrl: m.mediaUrl,
      mediaType: m.mediaType,
      read: m.authorId === me.id,
    }));

    const newestCursor =
      mapped.length
        ? encodeCursor(new Date(mapped[mapped.length - 1].at), mapped[mapped.length - 1].id)
        : null;

    return Response.json({
      ok: true,
      me: {
        id: me.id,
        role: meProfile?.role ?? null,
        avatarUrl: meAvatarUrl,
      },
      group: {
        id: convo.id,
        name: convo.title ?? 'Group',
        avatarUrl: convo.avatarUrl ?? null,
        members: convo.members.map((m) => ({
          id: m.user.id,
          handle: m.user.handle,
          displayName: m.user.displayName,
          avatarUrl:
            m.user.avatarUrl && m.user.avatarUrl.trim()
              ? m.user.avatarUrl
              : null,
          role: m.role,
        })),
      },
      typingUserIds: typingRows.map((r) => r.userId),
      messages: mapped,
      pageSize: take,
      cursors: {
        older: (latestParam || beforeParam) ? olderCursor : (sinceParam ? null : olderCursor),
        newest: newestCursor,
      },
    });
  } catch (e) {
    console.error('GET /api/chat/group/[id] failed:', e);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

/* ------------------------------- POST -------------------------------- */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const me = await getCurrentUser();
    if (!me) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

    // ✅ Minimal select
    const convo = await prisma.conversation.findUnique({
      where: { id },
      select: { 
        type: true, 
        members: { 
          where: { userId: me.id },
          select: { userId: true } 
        } 
      },
    });

    if (!convo) return Response.json({ ok: false, error: 'Not found' }, { status: 404 });
    if (convo.type !== ConversationType.GROUP) {
      return Response.json({ ok: false, error: 'NOT_A_GROUP' }, { status: 400 });
    }
    if (!convo.members.length) {
      return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const ct = req.headers.get('content-type') || '';

    /* ---------- A) multipart/form-data: Server-seitiger Upload ---------- */
    if (ct.includes('multipart/form-data')) {
      const form = await req.formData();

      const textRaw = form.get('text');
      const text = typeof textRaw === 'string' ? textRaw.trim() : '';

      const fileEntry = form.get('file');
      const file = fileEntry && typeof fileEntry !== 'string' ? (fileEntry as File) : null;

      if (!text && !file) {
        return Response.json({ ok: false, error: 'Empty message' }, { status: 400 });
      }

      let mediaUrl: string | null = null;
      let mediaType: string | null = null;

      if (file) {
        const type = file.type || 'application/octet-stream';
        if (!isAllowedMime(type)) {
          return Response.json({ ok: false, error: 'Unsupported file type' }, { status: 400 });
        }
        const maxBytes = MAX_UPLOAD_MB * 1024 * 1024;
        if (file.size > maxBytes) {
          return Response.json(
            { ok: false, error: `File too large (max ${MAX_UPLOAD_MB} MB)` },
            { status: 413 },
          );
        }

        const storage = getStorage();
        const key = buildKey('chat-media', file.name || 'upload.bin');

        const isVideo = /^video\//.test(type);
        const isAudio = /^audio\//.test(type);
        const cacheControl =
          isVideo ? 'public, max-age=604800' :
          isAudio ? 'public, max-age=2592000' :
                    'public, max-age=31536000, immutable';

        const { publicUrl } = await storage.put({
          key,
          data: await file.arrayBuffer(),
          contentType: type,
          cacheControl,
        });
        mediaUrl = publicUrl;
        mediaType = type;
      }

      if (text) {
        const isEnvelope = ENVELOPE_RE.test(text);
        if (text.length > (isEnvelope ? MAX_ENVELOPE_TEXT : MAX_TEXT)) {
          return Response.json({ ok: false, error: 'Too long' }, { status: 400 });
        }
      }

      const created = await prisma.message.create({
        data: {
          conversationId: id,
          authorId: me.id,
          text: text || null,
          mediaUrl,
          mediaType,
        },
        select: {
          id: true,
          createdAt: true,
          authorId: true,
          text: true,
          mediaUrl: true,
          mediaType: true,
        },
      });

      // ✅ Fire-and-forget update
      prisma.conversation.update({
        where: { id },
        data: { lastMessageId: created.id, lastMessageAt: created.createdAt },
      }).catch((err) => console.error('Failed to update lastMessage:', err));

      return Response.json({
        ok: true,
        message: {
          id: created.id,
          at: created.createdAt.toISOString(),
          authorId: created.authorId,
          text: created.text,
          mediaUrl: created.mediaUrl,
          mediaType: created.mediaType,
        },
      });
    }

    /* ---------- B) JSON: presigned Upload / typing ---------- */
    const body = (await req.json().catch(() => null)) as
      | { text?: string; typing?: boolean; mediaUrl?: string; mediaType?: string }
      | null;

    // ✅ Typing Ping (optimiert)
    if (body && typeof body.typing === 'boolean') {
      if (body.typing) {
        prisma.conversationTypingState.upsert({
          where: { conversationId_userId: { conversationId: id, userId: me.id } },
          update: { updatedAt: new Date() },
          create: { conversationId: id, userId: me.id, updatedAt: new Date() },
        }).catch(() => {});
      } else {
        prisma.conversationTypingState.deleteMany({
          where: { conversationId: id, userId: me.id },
        }).catch(() => {});
      }
      return Response.json({ ok: true });
    }

    const text = (body?.text ?? '').toString().trim();
    const bodyMediaUrl =
      typeof body?.mediaUrl === 'string' && body.mediaUrl ? body.mediaUrl : null;
    const bodyMediaType =
      typeof body?.mediaType === 'string' && body.mediaType ? body.mediaType : null;

    if (!text && !bodyMediaUrl) {
      return Response.json({ ok: false, error: 'Empty message' }, { status: 400 });
    }

    if (text) {
      const isEnvelope = ENVELOPE_RE.test(text);
      if (text.length > (isEnvelope ? MAX_ENVELOPE_TEXT : MAX_TEXT)) {
        return Response.json({ ok: false, error: 'Too long' }, { status: 400 });
      }
    }

    if (bodyMediaType && !isAllowedMime(bodyMediaType)) {
      return Response.json({ ok: false, error: 'Unsupported file type' }, { status: 400 });
    }

    const msg = await prisma.message.create({
      data: {
        conversationId: id,
        authorId: me.id,
        text: text || null,
        mediaUrl: bodyMediaUrl,
        mediaType: bodyMediaType || null,
      },
      select: {
        id: true,
        createdAt: true,
        authorId: true,
        text: true,
        mediaUrl: true,
        mediaType: true,
      },
    });

    // ✅ Fire-and-forget update
    prisma.conversation.update({
      where: { id },
      data: { lastMessageId: msg.id, lastMessageAt: msg.createdAt },
    }).catch((err) => console.error('Failed to update lastMessage:', err));

    // ✅ Typing state clearen (fire-and-forget)
    prisma.conversationTypingState.deleteMany({
      where: { conversationId: id, userId: me.id },
    }).catch(() => {});

    return Response.json({
      ok: true,
      message: {
        id: msg.id,
        at: msg.createdAt.toISOString(),
        authorId: msg.authorId,
        text: msg.text,
        mediaUrl: msg.mediaUrl,
        mediaType: msg.mediaType,
      },
    });
  } catch (e) {
    console.error('POST /api/chat/group/[id] failed:', e);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}