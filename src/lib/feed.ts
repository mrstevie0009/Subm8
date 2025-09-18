//src/lib/feed.ts
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { relativeTime } from '@/lib/relativeTime';
import type { Role } from '@prisma/client';

function toUiRole(role: Role): 'domme' | 'submissive' {
  return role === 'DOMME' ? 'domme' : 'submissive';
}

async function ensureBlockTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Block" (
      "blockerId" TEXT NOT NULL,
      "blockedId" TEXT NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Block_pkey" PRIMARY KEY ("blockerId","blockedId"),
      CONSTRAINT "Block_blockerId_fkey"
        FOREIGN KEY ("blockerId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "Block_blockedId_fkey"
        FOREIGN KEY ("blockedId") REFERENCES "User"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Block_blocked_idx"
    ON "Block"("blockedId","blockerId");
  `);
}

export async function loadHomeFeed(locale: string, take = 30){
  const me = await getCurrentUser().catch(() => null);

  const posts = await prisma.post.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      author: {
        select: {
          id: true,
          handle: true,
          displayName: true,
          role: true,
          avatarUrl: true,
        },
      },
      _count: { select: { Comment: true, Like: true } },
    },
    take,
  });

  let likedSet = new Set<string>();
  let bookmarkedSet = new Set<string>();
  let hasBlockedSet = new Set<string>();
  let blockedBySet = new Set<string>();

  if (me) {
    await ensureBlockTables();

    const [likedByMe, bookmarkedByMe] = await Promise.all([
      prisma.like.findMany({
        where: { userId: me.id, postId: { in: posts.map((p) => p.id) } },
        select: { postId: true },
      }),
      prisma.bookmark.findMany({
        where: { userId: me.id, postId: { in: posts.map((p) => p.id) } },
        select: { postId: true },
      }),
    ]);
    likedSet = new Set(likedByMe.map((l) => l.postId));
    bookmarkedSet = new Set(bookmarkedByMe.map((b) => b.postId));

    const authorIds = Array.from(new Set(posts.map((p) => p.author.id)));
    if (authorIds.length) {
      const [myBlocks, blocksMe] = await Promise.all([
        prisma.block.findMany({
          where: { blockerId: me.id, blockedId: { in: authorIds } },
          select: { blockedId: true },
        }),
        prisma.block.findMany({
          where: { blockerId: { in: authorIds }, blockedId: me.id },
          select: { blockerId: true },
        }),
      ]);
      hasBlockedSet = new Set(myBlocks.map((b) => b.blockedId));
      blockedBySet = new Set(blocksMe.map((b) => b.blockerId));
    }
  }

  return posts.map((p) => ({
    id: p.id,
    author: {
      name: p.author.displayName,
      role: toUiRole(p.author.role),
      handle: p.author.handle,
      avatarUrl: p.author.avatarUrl ?? undefined,
    },
    createdAt: relativeTime(p.createdAt, locale),
    text: p.text,
    mediaUrl: p.mediaUrl ?? undefined,
    mediaAlt: p.mediaAlt ?? undefined,
    stats: {
      comments: p._count?.Comment ?? 0,
      reposts: 0,
      likes: p._count?.Like ?? 0,
    },
    viewer: {
      liked: likedSet.has(p.id),
      bookmarked: bookmarkedSet.has(p.id),
      hasBlockedAuthor: me ? hasBlockedSet.has(p.author.id) : false,
      blockedByAuthor: me ? blockedBySet.has(p.author.id) : false,
    },
    initiallyBookmarked: bookmarkedSet.has(p.id),
  }));
}
