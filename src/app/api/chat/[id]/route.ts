// src/app/api/chat/[id]/route.ts
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { getStorage, buildKey } from '@/lib/storage';
import { $Enums } from '@prisma/client';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;

  const me = await getCurrentUser();
  if (!me) return Response.json({ ok: false, error: 'unauth' }, { status: 401 });

  const convo = await prisma.conversation.findUnique({
    where: { id },
    select: { id: true, type: true, dommeId: true, subId: true },
  });
  if (!convo) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

  if (convo.type === $Enums.ConversationType.GROUP) {
    // Gruppe verlassen → Membership löschen
    await prisma.conversationMember.deleteMany({
      where: { conversationId: convo.id, userId: me.id },
    });
    return Response.json({ ok: true });
  }

  // DM: nur Teilnehmer dürfen „löschen“ (verstecken)
  const iAmDomme = convo.dommeId === me.id;
  const iAmSub   = convo.subId === me.id;
  if (!iAmDomme && !iAmSub) {
    return Response.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  await prisma.conversation.update({
    where: { id: convo.id },
    data: iAmDomme
      ? { hiddenForDomme: new Date(), unreadForDomme: 0 }
      : { hiddenForSub:   new Date(), unreadForSub:   0 },
  });

  return Response.json({ ok: true });
}
type DbRole = 'DOMME' | 'SUBMISSIVE';

/* ---------------------------- helpers ----------------------------------- */

// Maximalgröße für Uploads (MB) – per ENV konfigurierbar, Default 100 MB.
const MAX_UPLOAD_MB = Number(process.env.CHAT_UPLOAD_MAX_MB || '100');
const MAX_TEXT = 4000;
const MAX_ENVELOPE_TEXT = 16000; // z. B. 16k

const ENVELOPE_RE = /^(REPLY|TIPREQ|TIPPAID|ADREQ|ADACC|OWNREQ|OWNACC)::/;

function isAllowedMime(type: string) {
  return /^image\//.test(type) || /^video\//.test(type) || /^audio\//.test(type);
}

/** Prüft, ob A B blockiert oder B A blockiert (beide Richtungen). */
async function getBlockFlags(aUserId: string, bUserId: string) {
  const [aBlocksB, bBlocksA] = await Promise.all([
    prisma.block.findFirst({ where: { blockerId: aUserId, blockedId: bUserId } }),
    prisma.block.findFirst({ where: { blockerId: bUserId, blockedId: aUserId } }),
  ]);
  return {
    viewerHasBlocked: !!aBlocksB,
    isBlockedByOther: !!bBlocksA,
  };
}

/** Type Guards statt `any` */
function hasRoleField(u: unknown): u is { role?: DbRole | null } {
  return typeof u === 'object' && u !== null && 'role' in (u as Record<string, unknown>);
}
function hasAvatarField(u: unknown): u is { avatarUrl?: string | null } {
  return typeof u === 'object' && u !== null && 'avatarUrl' in (u as Record<string, unknown>);
}

/* ---------- Typing (nutzt bestehende Tabelle) ---------- */
const TYPING_TABLE = `"ConversationTypingState"`;

async function pingTyping(conversationId: string, userId: string) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO ${TYPING_TABLE} ("conversationId","userId","updatedAt")
     VALUES ($1,$2,NOW())
     ON CONFLICT ("conversationId","userId") DO UPDATE
       SET "updatedAt" = EXCLUDED."updatedAt";`,
    conversationId,
    userId,
  );
}

async function clearTyping(conversationId: string, userId: string) {
  await prisma.$executeRawUnsafe(
    `DELETE FROM ${TYPING_TABLE} WHERE "conversationId" = $1 AND "userId" = $2;`,
    conversationId,
    userId,
  );
}

/* ---------- Cursor-Helpers (NEU) ---------- */
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

/* -------------------------------- GET ----------------------------------- */

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;

    const me = await getCurrentUser();
    if (!me) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

    const url = new URL(_req.url);
    const fast = url.searchParams.get('fast') === '1';
    const latestParam = url.searchParams.get('latest') === '1';
    const beforeParam = decodeCursor(url.searchParams.get('before'));
    const sinceParam  = decodeCursor(url.searchParams.get('since'));
    // take begrenzen: 1..100 (default: latest?30:200 wie bisher)
    const take = Math.min(Math.max(Number(url.searchParams.get('take') || (latestParam ? 30 : 200)), 1), 100);

    const convo = await prisma.conversation.findUnique({
      where: { id },
      select: {
        id: true,
        type: true,
        dommeId: true,
        subId: true,
        domme: {
          select: {
            id: true, handle: true, displayName: true, avatarUrl: true, role: true,
            isFirstAdopter: true,
            premiumUntil: true,
          },
        },
        sub: {
          select: {
            id: true, handle: true, displayName: true, avatarUrl: true, role: true,
            isFirstAdopter: true,
            premiumUntil: true,
          },
        },
      },
    });
    if (!convo) return Response.json({ ok: false, error: 'Not found' }, { status: 404 });
    if (convo.type !== $Enums.ConversationType.DM) {
      return Response.json({ ok: false, error: 'NOT_A_DM' }, { status: 400 });
    }
    // Membership prüfen
    if (convo.dommeId !== me.id && convo.subId !== me.id) {
      return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const iAmDomme = convo.dommeId === me.id;
    const otherRaw = iAmDomme ? convo.sub : convo.domme;

    if (!otherRaw) {
      return Response.json(
        { ok: false, error: 'CONVERSATION_INCONSISTENT' },
        { status: 409 }
      );
    }

    const other = {
      id: otherRaw.id,
      handle: otherRaw.handle,
      displayName: otherRaw.displayName,
      avatarUrl: otherRaw.avatarUrl && otherRaw.avatarUrl.trim() ? otherRaw.avatarUrl : null,
      role: otherRaw.role,
      isFirstAdopter: otherRaw.isFirstAdopter ?? false,
      premiumUntil: otherRaw.premiumUntil ? otherRaw.premiumUntil.toISOString() : null,
    };

    // Eigenes Profil (Role + Avatar) sicher holen
    const meProfile = await prisma.user.findUnique({
      where: { id: me.id },
      select: { role: true, avatarUrl: true },
    });

    const meRole: DbRole | null =
      (hasRoleField(me) ? me.role ?? null : null) ?? meProfile?.role ?? null;

    const meAvatarUrlRaw =
      (hasAvatarField(me) ? me.avatarUrl ?? null : null) ?? meProfile?.avatarUrl ?? null;
    const meAvatarUrl = meAvatarUrlRaw && meAvatarUrlRaw.trim() ? meAvatarUrlRaw : null;

    // Block-Status in beide Richtungen
    const { viewerHasBlocked, isBlockedByOther } = await getBlockFlags(me.id, other.id);

    // --- Message-Query (Cursor-Pagination) ---
    type MessageBase = {
      id: string;
      createdAt: Date;
      authorId: string;
      text: string | null;
      mediaUrl: string | null;
      mediaType: string | null;
    };
    type MessageWithReads = MessageBase & { reads: { readerUserId: string }[] };
    type MessageMaybeReads = MessageBase | MessageWithReads;

    const baseWhere = { conversationId: id } as const;
    const baseSelect = {
      id: true,
      createdAt: true,
      authorId: true,
      text: true,
      mediaUrl: true,
      mediaType: true,
    } as const;

    let messagesDb: MessageMaybeReads[] = [];

    if (latestParam) {
      // letzte N → DESC limit, dann fürs UI aufsteigend sortieren
      const rows = await prisma.message.findMany({
        where: baseWhere,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take,
        select: fast
          ? baseSelect
          : {
              ...baseSelect,
              reads: { where: { readerUserId: me.id }, select: { readerUserId: true } },
            },
      });
      messagesDb = rows.reverse();

    } else if (beforeParam) {
      // ältere als Cursor → DESC limit, danach aufsteigend
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
        select: fast
          ? baseSelect
          : {
              ...baseSelect,
              reads: { where: { readerUserId: me.id }, select: { readerUserId: true } },
            },
      });
      messagesDb = rows.reverse();

    } else if (sinceParam) {
      // neuere als Cursor → direkt aufsteigend
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
        select: fast
          ? baseSelect
          : {
              ...baseSelect,
              reads: { where: { readerUserId: me.id }, select: { readerUserId: true } },
            },
      });

    } else {
      // Fallback: wie bisher → letzte N (damit wir nicht massiv laden), dann ASC
      const rows = await prisma.message.findMany({
        where: baseWhere,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take,
        select: fast
          ? baseSelect
          : {
              ...baseSelect,
              reads: { where: { readerUserId: me.id }, select: { readerUserId: true } },
            },
      });
      messagesDb = rows.reverse();
    }

    // Type Guard für Messages mit Reads
    const hasReads = (m: MessageMaybeReads): m is MessageWithReads =>
      Object.prototype.hasOwnProperty.call(m, 'reads');

    // Read-Marking nur im nicht-fast Modus
    if (!fast && messagesDb.length) {
      const unreadIds = (messagesDb as MessageMaybeReads[])
        .filter((m) => hasReads(m) && m.authorId !== me.id && m.reads.length === 0)
        .map((m) => m.id);
      if (unreadIds.length) {
        await prisma.messageRead.createMany({
          data: unreadIds.map((mid) => ({ messageId: mid, readerUserId: me.id })),
          skipDuplicates: true,
        });
      }
    }

    // Unread-Counter nullen (wie vorher), tolerant
    try {
      await prisma.conversation.update({
        where: { id },
        data: iAmDomme ? { unreadForDomme: 0 } : { unreadForSub: 0 },
      });
    } catch {
      // ignore
    }

    // otherTyping (letzte 8 Sekunden)
    const typingRow = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
      `SELECT EXISTS (
         SELECT 1 FROM ${TYPING_TABLE}
         WHERE "conversationId" = $1 AND "userId" = $2 AND "updatedAt" > NOW() - INTERVAL '8 seconds'
       ) AS "exists"`,
      id,
      other.id,
    );
    const otherTyping = Boolean(typingRow?.[0]?.exists);

    // olderCursor nur für latest/before berechnen
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

    const mapped = messagesDb.map((m) => {
      const read = fast ? m.authorId === me.id : (hasReads(m) ? m.reads.length > 0 : m.authorId === me.id);
      return {
        id: m.id,
        at: m.createdAt.toISOString(),
        authorId: m.authorId,
        text: m.text,
        mediaUrl: m.mediaUrl,
        mediaType: m.mediaType,
        read,
      };
    });

    const newestCursor =
      mapped.length
        ? encodeCursor(new Date(mapped[mapped.length - 1].at), mapped[mapped.length - 1].id)
        : null;

    return Response.json({
      ok: true,
      me: { id: me.id, role: meRole ?? undefined, avatarUrl: meAvatarUrl },
      other,
      otherTyping,
      viewerHasBlocked,
      isBlockedByOther,
      messages: mapped,
      pageSize: take,
      cursors: {
        older: (latestParam || beforeParam) ? olderCursor : (sinceParam ? null : olderCursor),
        newest: newestCursor,
      },
    });
  } catch (e) {
    console.error('GET /api/chat/[id] failed:', e);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

/* -------------------------------- POST ---------------------------------- */

export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const me = await getCurrentUser();
    if (!me) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

    const convo = await prisma.conversation.findUnique({
      where: { id },
      select: { id: true, type: true, dommeId: true, subId: true },
    });

    if (!convo) return Response.json({ ok: false, error: 'Not found' }, { status: 404 });
    if (convo.dommeId !== me.id && convo.subId !== me.id) {
      return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    if (convo.type !== $Enums.ConversationType.DM) {
      return Response.json({ ok: false, error: 'NOT_A_DM' }, { status: 400 });
    }

    const otherUserId = convo.dommeId === me.id ? convo.subId : convo.dommeId;

    if (!otherUserId) {
      return Response.json(
        { ok: false, error: 'CONVERSATION_INCONSISTENT' },
        { status: 409 }
      );
    }
    const { viewerHasBlocked, isBlockedByOther } = await getBlockFlags(me.id, otherUserId);
    if (viewerHasBlocked || isBlockedByOther) {
      return Response.json({ ok: false, error: 'INTERACTION_BLOCKED' }, { status: 403 });
    }

    const ct = req.headers.get('content-type') || '';

    // Multipart: text + file
    if (ct.includes('multipart/form-data')) {
      const form = await req.formData();

      const textRaw = form.get('text');
      const text =
        typeof textRaw === 'string'
          ? textRaw.trim()
          : '';

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
            { status: 413 }
          );
        }

        // ⬇️ Upload nach R2/S3 via Storage-Adapter
        const storage = getStorage();
        const key = buildKey('chat-media', file.name || 'upload.bin');
        const isVideo = /^video\//.test(type);
        const isAudio = /^audio\//.test(type);
        const cacheControl =
          isVideo ? 'public, max-age=604800' :               // 7 Tage
          isAudio ? 'public, max-age=2592000' :              // 30 Tage
                    'public, max-age=31536000, immutable';   // 1 Jahr
        const { publicUrl } = await storage.put({
          key,
          data: await file.arrayBuffer(),
          contentType: type,
          cacheControl,
        });
        mediaUrl = publicUrl;
        mediaType = type;
      }

      const created = await prisma.message.create({
        data: {
          conversationId: id,
          authorId: me.id,
          text,
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

      await prisma.conversation.update({
        where: { id },
        data: {
          lastMessageId: created.id,
          lastMessageAt: created.createdAt,
          ...(me.id === convo.dommeId
            ? { unreadForSub: { increment: 1 }, hiddenForSub: null }     // Empfänger wieder sichtbar machen
            : { unreadForDomme: { increment: 1 }, hiddenForDomme: null } // Empfänger wieder sichtbar machen
          ),
        },
      });

      // beim Senden: Typing-State räumen (best effort)
      await clearTyping(id, me.id).catch(() => {});

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

    // JSON: text only OR typing ping OR pre-uploaded media (via presign)
    const body = (await req.json().catch(() => null)) as {
      text?: string;
      typing?: boolean;
      mediaUrl?: string;
      mediaType?: string;
    } | null;

    // Typing ping
    if (body && typeof body.typing === 'boolean') {
      if (body.typing) {
        await pingTyping(id, me.id);
      } else {
        await clearTyping(id, me.id);
      }
      return Response.json({ ok: true });
    }

    // Normaler Text
    const text = (body?.text ?? '').toString().trim();
    const bodyMediaUrl = typeof body?.mediaUrl === 'string' && body.mediaUrl ? body.mediaUrl : null;
    const bodyMediaType = typeof body?.mediaType === 'string' && body.mediaType ? body.mediaType : null;

    if (!text && !bodyMediaUrl) {
      return Response.json({ ok: false, error: 'Empty message' }, { status: 400 });
    }

    if (text) {
      const isEnvelope = ENVELOPE_RE.test(text);
      if (text.length > (isEnvelope ? MAX_ENVELOPE_TEXT : MAX_TEXT)) {
        return Response.json({ ok: false, error: 'Too long' }, { status: 400 });
      }
      if (text.length > 4000) return Response.json({ ok: false, error: 'Too long' }, { status: 400 });
    }

    // Optional: Mime guarden, falls mediaType mitkommt
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
      select: { id: true, createdAt: true, authorId: true, text: true, mediaUrl: true, mediaType: true },
    });

    await prisma.conversation.update({
      where: { id },
      data: {
        lastMessageId: msg.id,
        lastMessageAt: msg.createdAt,
        ...(me.id === convo.dommeId
          ? { unreadForSub: { increment: 1 }, hiddenForSub: null }     // Empfänger wieder sichtbar machen
          : { unreadForDomme: { increment: 1 }, hiddenForDomme: null } // Empfänger wieder sichtbar machen
        ),
      },
    });

    // Beim Senden: Typing-State räumen
    await clearTyping(id, me.id).catch(() => {});

    return Response.json({
      ok: true,
      message: {
        id: msg.id,
        at: msg.createdAt.toISOString(),
        authorId: msg.authorId,
        text: msg.text,
        mediaUrl: (msg).mediaUrl ?? null,
        mediaType: (msg).mediaType ?? null,
      },
    });
  } catch (e) {
    console.error('POST /api/chat/[id] failed:', e);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
