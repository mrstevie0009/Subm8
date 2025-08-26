// src/app/api/chat/[id]/route.ts
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

// --- helpers ---------------------------------------------------------------

function sanitizeFileName(name: string) {
  // keep extension, strip weird chars
  const base = name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
  return base.length ? base : `upload_${Date.now()}`;
}

function isAllowedMime(type: string) {
  return /^image\//.test(type) || /^video\//.test(type);
}

// --- GET -------------------------------------------------------------------

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = params;
    const me = await getCurrentUser();
    if (!me) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

    const convo = await prisma.conversation.findUnique({
      where: { id },
      select: {
        id: true,
        dommeId: true,
        subId: true,
        domme: { select: { id: true, handle: true, displayName: true, avatarUrl: true } },
        sub:   { select: { id: true, handle: true, displayName: true, avatarUrl: true } },
      },
    });
    if (!convo) return Response.json({ ok: false, error: 'Not found' }, { status: 404 });
    if (convo.dommeId !== me.id && convo.subId !== me.id) {
      return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const iAmDomme = convo.dommeId === me.id;
    const other = iAmDomme ? convo.sub : convo.domme;

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
      take: 200,
      select: {
        id: true,
        createdAt: true,
        authorId: true,
        text: true,
        mediaUrl: true,
        mediaType: true,
        reads: { where: { readerUserId: me.id }, select: { readerUserId: true } },
      },
    });

    // mark as read (only messages from the other user that aren't marked yet)
    const unreadIds = messages
      .filter((m) => m.authorId !== me.id && m.reads.length === 0)
      .map((m) => m.id);

    if (unreadIds.length) {
      await prisma.messageRead.createMany({
        data: unreadIds.map((mid) => ({ messageId: mid, readerUserId: me.id })),
        skipDuplicates: true,
      });
    }

    return Response.json({
      ok: true,
      me: { id: me.id },
      other,
      messages: messages.map((m) => ({
        id: m.id,
        at: m.createdAt.toISOString(),
        authorId: m.authorId,
        text: m.text,
        mediaUrl: m.mediaUrl,
        mediaType: m.mediaType,
        read: m.reads.length > 0 || m.authorId === me.id,
      })),
    });
  } catch (e) {
    console.error('GET /api/chat/[id] failed:', e);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

// --- POST (JSON or multipart/form-data) ------------------------------------

export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id } = params;
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

    const ct = req.headers.get('content-type') || '';

    // Multipart: text + file
    if (ct.includes('multipart/form-data')) {
      const form = await req.formData();

      const textRaw = form.get('text');
      const text =
        (typeof textRaw === 'string' ? textRaw : (textRaw as File | null)?.name ?? '')
          .toString()
          .trim() || null;

      const fileEntry = form.get('file');
      const file = fileEntry && typeof fileEntry !== 'string' ? (fileEntry as File) : null;

      if (!text && !file) {
        return Response.json({ ok: false, error: 'Empty message' }, { status: 400 });
      }

      let mediaUrl: string | null = null;
      let mediaType: string | null = null;

      if (file) {
        // basic validations
        const type = file.type || 'application/octet-stream';
        if (!isAllowedMime(type)) {
          return Response.json({ ok: false, error: 'Unsupported file type' }, { status: 400 });
        }
        const maxBytes = 25 * 1024 * 1024; // 25 MB
        if (file.size > maxBytes) {
          return Response.json({ ok: false, error: 'File too large' }, { status: 413 });
        }

        // store under /public/uploads, return URL with forward slashes
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

    // JSON: text only
    const body = (await req.json().catch(() => null)) as { text?: string } | null;
    const text = (body?.text ?? '').toString().trim();
    if (!text) return Response.json({ ok: false, error: 'Empty message' }, { status: 400 });
    if (text.length > 4000) return Response.json({ ok: false, error: 'Too long' }, { status: 400 });

    const msg = await prisma.message.create({
      data: { conversationId: id, authorId: me.id, text },
      select: { id: true, createdAt: true, authorId: true, text: true },
    });

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
