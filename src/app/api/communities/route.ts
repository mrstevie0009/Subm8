//src/app/api/communities/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuth } from '@/lib/auth';
import { randomUUID } from 'node:crypto';
import { guardAndSave, envMaxUploadBytes } from '@/lib/uploadGuard';
import { CommunityJoinPolicy } from '@prisma/client';

export const runtime = 'nodejs';

type JoinPolicy = 'OPEN' | 'INVITE_ONLY' | 'DOMME_ONLY' | 'SUB_ONLY';

const POLICY_TO_PRISMA: Record<JoinPolicy, CommunityJoinPolicy> = {
  OPEN: CommunityJoinPolicy.OPEN,
  INVITE_ONLY: CommunityJoinPolicy.INVITE_ONLY,
  DOMME_ONLY: CommunityJoinPolicy.DOMME_ONLY,
  SUB_ONLY: CommunityJoinPolicy.SUB_ONLY,
};
function prismaToApiPolicy(p: CommunityJoinPolicy): JoinPolicy {
  switch (p) {
    case CommunityJoinPolicy.OPEN: return 'OPEN';
    case CommunityJoinPolicy.INVITE_ONLY: return 'INVITE_ONLY';
    case CommunityJoinPolicy.DOMME_ONLY: return 'DOMME_ONLY';
    case CommunityJoinPolicy.SUB_ONLY: return 'SUB_ONLY';
  }
}

function slugify(input: string) {
  const base = input
    .trim().toLowerCase()
    .replace(/^@/, '')
    .replace(/[^a-z0-9\-_\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
  return base || `c-${Math.random().toString(36).slice(2, 8)}`;
}

type CommunityOut = {
  id: string;
  slug: string;
  name: string;
  description: string;
  members: number;
  joined: boolean;
  policy: JoinPolicy;
  bannerUrl?: string | null;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mine = url.searchParams.get('mine') === '1';
  const q = (url.searchParams.get('q') || '').trim();
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '24', 10) || 24, 1), 100);

  const session = await getAuth().catch(() => null);
  const meId = (session?.user as { id?: string } | undefined)?.id;

  if (mine) {
    if (!meId) return NextResponse.json({ ok: true, items: [] });

    const rows = await prisma.community.findMany({
      where: { CommunityMember: { some: { userId: meId } } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        createdById: true,
        joinPolicy: true,
        bannerUrl: true,
        _count: { select: { CommunityMember: true } },
      },
      take: limit,
    });

    const items: CommunityOut[] = rows.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description || '',
      members: c._count.CommunityMember,
      joined: true,
      policy: prismaToApiPolicy(c.joinPolicy),
      bannerUrl: c.bannerUrl,
    }));
    return NextResponse.json({ ok: true, items });
  }

  const rows = await prisma.community.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { slug: { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: { CommunityMember: { _count: 'desc' } },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      createdById: true,
      joinPolicy: true,
      bannerUrl: true,
      _count: { select: { CommunityMember: true } },
    },
    take: limit,
  });

  let joinedSet: Set<string> | null = null;
  if (meId && rows.length > 0) {
    const memberships = await prisma.communityMember.findMany({
      where: { userId: meId, communityId: { in: rows.map((r) => r.id) } },
      select: { communityId: true },
    });
    joinedSet = new Set(memberships.map((m) => m.communityId));
  }

  const items: CommunityOut[] = rows.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description || '',
    members: c._count.CommunityMember,
    joined: joinedSet ? joinedSet.has(c.id) : false,
    policy: prismaToApiPolicy(c.joinPolicy),
    bannerUrl: c.bannerUrl,
  }));

  return NextResponse.json({ ok: true, items });
}

export async function POST(req: Request) {
  try {
    const session = await getAuth();
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const ct = req.headers.get('content-type') || '';
    let name = '', handleRaw = '', description = '', policyKey: JoinPolicy = 'OPEN';
    let bannerUrl: string | undefined;

    if (ct.startsWith('multipart/form-data')) {
      const fd = await req.formData();
      name = (fd.get('name') ?? '').toString().trim();
      handleRaw = (fd.get('handle') ?? '').toString();
      description = (fd.get('description') ?? '').toString().trim();

      const p = (fd.get('policy') ?? 'OPEN').toString().trim().toUpperCase();
      if (['OPEN', 'INVITE_ONLY', 'DOMME_ONLY', 'SUB_ONLY'].includes(p)) {
        policyKey = p as JoinPolicy;
      }

      const banner = fd.get('banner');
      if (banner && banner instanceof File && banner.size > 0) {
        const saved = await guardAndSave(banner, {
          publicSubdir: 'community-banners',
          maxSize: envMaxUploadBytes(10),
        });
        if (!saved.ok) {
          return NextResponse.json({ ok: false, error: saved.message }, { status: 400 });
        }
        bannerUrl = saved.publicPath;
      }
    } else {
      const body = (await req.json().catch(() => ({}))) as {
        name?: string;
        handle?: string;
        description?: string;
        policy?: JoinPolicy;
      };
      name = (body?.name || '').toString().trim();
      handleRaw = (body?.handle || '').toString();
      description = (body?.description || '').toString().trim();
      if (body?.policy && POLICY_TO_PRISMA[body.policy]) policyKey = body.policy;
    }

    if (name.length < 3) {
      return NextResponse.json({ ok: false, error: 'NAME_TOO_SHORT' }, { status: 400 });
    }

    let slug = slugify(handleRaw || name);
    const exists = await prisma.community.findUnique({ where: { slug } });
    if (exists) {
      slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`;
      const exists2 = await prisma.community.findUnique({ where: { slug } });
      if (exists2) {
        return NextResponse.json({ ok: false, error: 'SLUG_TAKEN' }, { status: 409 });
      }
    }

    const id = randomUUID();

    const created = await prisma.community.create({
      data: {
        id,
        slug,
        name,
        description: description || null,
        createdById: userId,
        joinPolicy: POLICY_TO_PRISMA[policyKey],
        bannerUrl: bannerUrl ?? null,
      },
      select: {
        id: true, slug: true, name: true, description: true, bannerUrl: true, joinPolicy: true,
      },
    });

    await prisma.communityMember.create({
      data: { communityId: id, userId, role: 'ADMIN' },
    });

    const out: CommunityOut = {
      id: created.id,
      slug: created.slug,
      name: created.name,
      description: created.description || '',
      bannerUrl: created.bannerUrl,
      policy: prismaToApiPolicy(created.joinPolicy),
      members: 1,
      joined: true,
    };

    return NextResponse.json({ ok: true, community: out });
  } catch {
    return NextResponse.json({ ok: false, error: 'FAILED_TO_CREATE' }, { status: 500 });
  }
}
