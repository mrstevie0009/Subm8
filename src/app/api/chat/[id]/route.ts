// src/app/api/chat/[id]/route.ts
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };
type DbRole = 'DOMME' | 'SUBMISSIVE';

/* ---------------------------- helpers ----------------------------------- */

// Maximalgröße für Uploads (MB) – per ENV konfigurierbar, Default 100 MB.
const MAX_UPLOAD_MB = Number(process.env.CHAT_UPLOAD_MAX_MB || '100');
const MAX_TEXT = 4000;
const MAX_ENVELOPE_TEXT = 16000; // z. B. 16k
const ENVELOPE_RE = /^(REPLY|TIPREQ|TIPPAID|ADREQ|ADACC|OWNREQ|OWNACC)::/;

function sanitizeFileName(name: string) {
  const base = name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
  return base.length ? base : `upload_${Date.now()}`;
}

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

/* -------------------------------- GET ----------------------------------- */

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const url = new URL(_req.url);
    const fast = url.searchParams.get('fast') === '1';
    const take = Number(url.searchParams.get('take') || (fast ? '30' : '200'));

    const me = await getCurrentUser();
    if (!me) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

    const convo = await prisma.conversation.findUnique({
      where: { id },
      select: {
        id: true,
        dommeId: true,
        subId: true,
        domme: { select: { id: true, handle: true, displayName: true, avatarUrl: true, role: true } },
        sub:   { select: { id: true, handle: true, displayName: true, avatarUrl: true, role: true } },
      },
    });
    if (!convo) return Response.json({ ok: false, error: 'Not found' }, { status: 404 });
    if (convo.dommeId !== me.id && convo.subId !== me.id) {
      return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const iAmDomme = convo.dommeId === me.id;
    const other = iAmDomme ? convo.sub : convo.domme;

    // Eigenes Profil (Role + Avatar) sicher holen
    const meProfile = await prisma.user.findUnique({
      where: { id: me.id },
      select: { role: true, avatarUrl: true },
    });

    const meRole: DbRole | null =
      (hasRoleField(me) ? me.role ?? null : null) ?? meProfile?.role ?? null;

    const meAvatarUrl: string | null =
      (hasAvatarField(me) ? me.avatarUrl ?? null : null) ?? meProfile?.avatarUrl ?? null;

    // Block-Status in beide Richtungen
    const { viewerHasBlocked, isBlockedByOther } = await getBlockFlags(me.id, other.id);

    // --- streng typisiert ohne `any`
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

    const baseSelect = {
      id: true,
      createdAt: true,
      authorId: true,
      text: true,
      mediaUrl: true,
      mediaType: true,
    } as const;

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
      take,
      select: fast
        ? baseSelect
        : {
            ...baseSelect,
            reads: { where: { readerUserId: me.id }, select: { readerUserId: true } },
          },
    }) as unknown as MessageMaybeReads[];

    // Type Guard für Messages mit Reads
    const hasReads = (m: MessageMaybeReads): m is MessageWithReads =>
      Object.prototype.hasOwnProperty.call(m, 'reads');

    // Fast-Mode: keine DB-Writes (Reads); regulär wie gehabt
    if (!fast) {
      const unreadIds = messages
        .filter((m) => hasReads(m) && m.authorId !== me.id && m.reads.length === 0)
        .map((m) => m.id);
      if (unreadIds.length) {
        await prisma.messageRead.createMany({
          data: unreadIds.map((mid) => ({ messageId: mid, readerUserId: me.id })),
          skipDuplicates: true,
        });
      }
    }

    // otherTyping (letzte 8s)
    const typingRow = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
      `SELECT EXISTS (
         SELECT 1 FROM ${TYPING_TABLE}
         WHERE "conversationId" = $1 AND "userId" = $2 AND "updatedAt" > NOW() - INTERVAL '8 seconds'
       ) AS "exists"`,
      id,
      other.id,
    );
    const otherTyping = Boolean(typingRow?.[0]?.exists);

    return Response.json({
      ok: true,
      me: { id: me.id, role: meRole ?? undefined, avatarUrl: meAvatarUrl },
      other,
      otherTyping,
      viewerHasBlocked,
      isBlockedByOther,
      messages: messages
        .map((m) => {
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
        }),
      pageSize: take,
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
      select: { id: true, dommeId: true, subId: true },
    });
    if (!convo) return Response.json({ ok: false, error: 'Not found' }, { status: 404 });
    if (convo.dommeId !== me.id && convo.subId !== me.id) {
      return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const otherUserId = convo.dommeId === me.id ? convo.subId : convo.dommeId;
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

        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        await fs.mkdir(uploadsDir, { recursive: true });

        const safe = sanitizeFileName(file.name);
        const filename = `${randomUUID()}_${safe}`;
        const absPath = path.join(uploadsDir, filename);

        const buf = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(absPath, buf);

        mediaUrl = `/uploads/${encodeURIComponent(filename)}`;
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
          // unread für die GEGENSEITE erhöhen:
          ...(me.id === convo.dommeId
            ? { unreadForSub: { increment: 1 } }
            : { unreadForDomme: { increment: 1 } }),
        },
      });

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

    // JSON: text only OR typing ping
    const body = (await req.json().catch(() => null)) as { text?: string; typing?: boolean } | null;

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
    if (!text) return Response.json({ ok: false, error: 'Empty message' }, { status: 400 });

    const isEnvelope = ENVELOPE_RE.test(text);
    if (text.length > (isEnvelope ? MAX_ENVELOPE_TEXT : MAX_TEXT)) {
      return Response.json({ ok: false, error: 'Too long' }, { status: 400 });
    }
    if (text.length > 4000) return Response.json({ ok: false, error: 'Too long' }, { status: 400 });

    const msg = await prisma.message.create({
      data: { conversationId: id, authorId: me.id, text },
      select: { id: true, createdAt: true, authorId: true, text: true },
    });

    await prisma.conversation.update({
      where: { id },
      data: {
        lastMessageId: msg.id,
        lastMessageAt: msg.createdAt,
        ...(me.id === convo.dommeId
          ? { unreadForSub: { increment: 1 } }
          : { unreadForDomme: { increment: 1 } }),
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
      },
    });
  } catch (e) {
    console.error('POST /api/chat/[id] failed:', e);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
