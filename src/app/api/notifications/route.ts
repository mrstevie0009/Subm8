// src/app/api/notifications/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

// ---------- Settings ----------
type NotifSettings = {
  pushEnabled: boolean;
  uiSound: boolean; uiPopup: boolean;
  dmMessages: boolean; dmReactions: boolean;
  mentions: boolean; comments: boolean; likes: boolean; newFollowers: boolean;
  muteNotFollowing: boolean; muteNotFollowers: boolean; muteNewAccounts: boolean; muteNoAvatar: boolean;
  requirePhoneVerified: boolean;
};

const SETTINGS_DEFAULTS: NotifSettings = {
  pushEnabled: true,
  uiSound: true, uiPopup: true,
  dmMessages: true, dmReactions: true,
  mentions: true, comments: true, likes: true, newFollowers: true,
  muteNotFollowing: false, muteNotFollowers: false, muteNewAccounts: false, muteNoAvatar: false,
  requirePhoneVerified: false,
};

async function readSettings(userId: string): Promise<NotifSettings> {
  const row = await prisma.$queryRaw<Array<Partial<NotifSettings>>>`
    SELECT
      "pushEnabled",
      "uiSound","uiPopup",
      "dmMessages","dmReactions",
      "mentions","comments","likes","newFollowers",
      "muteNotFollowing","muteNotFollowers","muteNewAccounts","muteNoAvatar",
      "requirePhoneVerified"
    FROM "UserNotificationSettings"
    WHERE "userId" = ${userId}
    LIMIT 1
  `;
  return { ...SETTINGS_DEFAULTS, ...(row[0] || {}) };
}

// ---------- API Item Types (Server) ----------
type NotiUser = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl?: string | null;
  viewerFollows?: boolean;
  phoneVerified?: boolean | null;
  createdAt?: Date;
};

type NotiItem =
  | { id: string; kind: 'follow'; time: string; user: NotiUser }
  | { id: string; kind: 'like'; time: string; user: NotiUser; text: string; postId: string }
  | { id: string; kind: 'like_batch'; time: string; user: NotiUser; count: number }
  | { id: string; kind: 'mention'; time: string; user: NotiUser; text: string; postId?: string }
  | { id: string; kind: 'comment'; time: string; user: NotiUser; text: string; postId: string }
  | { id: string; kind: 'reply'; time: string; user: NotiUser; text: string; postId: string }
  | { id: string; kind: 'comment_like'; time: string; user: NotiUser; text: string; postId: string };

export async function GET(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) {
      return NextResponse.json(
        { ok: true, items: [] as NotiItem[] },
        { status: 200, headers: { 'cache-control': 'private, no-store' } },
      );
    }

    const url = new URL(req.url);
    const tab = (url.searchParams.get('tab') || 'all') as 'all' | 'mentions' | 'comments';
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 100);

    // ---- Settings laden
    const settings = await readSettings(me.id);

    // ---- Follow-Beziehungen vorab (für Filter & viewerFollows)
    const [iFollow, followMe] = await Promise.all([
      prisma.follow.findMany({
        where: { followerId: me.id },
        select: { followeeId: true },
      }),
      prisma.follow.findMany({
        where: { followeeId: me.id },
        select: { followerId: true },
      }),
    ]);
    const iFollowSet = new Set(iFollow.map(f => f.followeeId));
    const followsMeSet = new Set(followMe.map(f => f.followerId));

    // Helper: Mute/Require-Filter prüfen
    const NEW_ACC_DAYS = 7;
    function isMutedByFilters(actor: NotiUser): boolean {
      const actorIsFollowed = iFollowSet.has(actor.id);
      if (actorIsFollowed) return false;

      if (settings.muteNotFollowing && !actorIsFollowed) return true;
      if (settings.muteNotFollowers && !followsMeSet.has(actor.id)) return true;
      if (settings.muteNoAvatar && !actor.avatarUrl) return true;
      if (settings.requirePhoneVerified && !actor.phoneVerified) return true;

      if (settings.muteNewAccounts && actor.createdAt) {
        const ageMs = Date.now() - actor.createdAt.getTime();
        if (ageMs < NEW_ACC_DAYS * 86400_000) return true;
      }
      return false;
    }

    // Helper: pro Kind per Setting erlauben
    function isEnabledKind(kind: NotiItem['kind']): boolean {
      if (kind === 'mention') return !!settings.mentions;
      if (kind === 'comment' || kind === 'reply' || kind === 'comment_like') return !!settings.comments;
      if (kind === 'like' || kind === 'like_batch') return !!settings.likes;
      if (kind === 'follow') return !!settings.newFollowers;
      return true;
    }

    // ---- Follows (you are the followee) ----
    const follows = await prisma.follow.findMany({
      where: { followeeId: me.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        createdAt: true,
        follower: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            avatarUrl: true,
            phone: true,
            createdAt: true,
          },
        },
      },
    });

    // ---- Likes on your POSTS (aggregated since cursor, Option B) ----
    const likeTake = Math.min(Math.max(limit * 5, limit), 500);

    const recentPostLikes = await prisma.like.findMany({
      where: { Post: { authorId: me.id } },
      orderBy: { createdAt: 'desc' },
      take: likeTake,
      select: {
        createdAt: true,
        userId: true,
        postId: true,
        User: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            avatarUrl: true,
            phone: true,
            createdAt: true,
          },
        },
        Post: { select: { id: true, text: true } },
      },
    });

    const actorIds = Array.from(new Set(recentPostLikes.map(l => l.userId)));

    // Cursor rows lesen (robust über SQL, damit Prisma-Client-Modelname egal ist)
    const cursorRows = actorIds.length
      ? await prisma.$queryRaw<Array<{ actorId: string; seenUntil: Date }>>`
          SELECT "actorId", "seenUntil"
          FROM "NotificationSeenCursor"
          WHERE "recipientId" = ${me.id}
            AND "kind" = 'LIKE_POST'
            AND "actorId" IN (${Prisma.join(actorIds)})
        `
      : [];

    const seenUntilByActor = new Map<string, Date>(cursorRows.map(r => [r.actorId, r.seenUntil]));

    type LikeRow = (typeof recentPostLikes)[number];
    const unseenByActor = new Map<string, LikeRow[]>();
    const maxDeliveredByActor = new Map<string, Date>();

    for (const l of recentPostLikes) {
      const seenUntil = seenUntilByActor.get(l.userId) ?? new Date(0);
      if (l.createdAt <= seenUntil) continue;

      const arr = unseenByActor.get(l.userId) ?? [];
      arr.push(l);
      unseenByActor.set(l.userId, arr);

      const prevMax = maxDeliveredByActor.get(l.userId);
      if (!prevMax || l.createdAt > prevMax) maxDeliveredByActor.set(l.userId, l.createdAt);
    }

    const likeNotis: NotiItem[] = [];
    for (const [actorId, likes] of unseenByActor.entries()) {
      // recentPostLikes ist desc => likes ist ebenfalls desc pro Actor
      likes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const newest = likes[0];
      const actor = newest.User;

      if (likes.length <= 1) {
        likeNotis.push({
          id: `like:${newest.userId}:${newest.postId}:${newest.createdAt.getTime()}`,
          kind: 'like',
          time: newest.createdAt.toISOString(),
          user: {
            id: newest.userId,
            handle: actor.handle,
            displayName: actor.displayName,
            avatarUrl: actor.avatarUrl,
            phoneVerified: !!actor.phone,
            createdAt: actor.createdAt,
            viewerFollows: iFollowSet.has(newest.userId),
          },
          text: newest.Post.text,
          postId: newest.Post.id,
        });
      } else {
        likeNotis.push({
          id: `like_batch:${actorId}:${newest.createdAt.getTime()}`,
          kind: 'like_batch',
          time: newest.createdAt.toISOString(),
          user: {
            id: actorId,
            handle: actor.handle,
            displayName: actor.displayName,
            avatarUrl: actor.avatarUrl,
            phoneVerified: !!actor.phone,
            createdAt: actor.createdAt,
            viewerFollows: iFollowSet.has(actorId),
          },
          count: likes.length,
        });
      }
    }

    // ---- Mentions in posts & comments ----
    const handlePattern = `@${me.handle}`;

    const postsWithMention = await prisma.post.findMany({
      where: { text: { contains: handlePattern, mode: 'insensitive' } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, createdAt: true, text: true,
        author: {
          select: {
            id: true, handle: true, displayName: true, avatarUrl: true,
            phone: true, createdAt: true,
          },
        },
      },
    });

    const commentsWithMention = await prisma.comment.findMany({
      where: { text: { contains: handlePattern, mode: 'insensitive' } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, createdAt: true, text: true,
        User: {
          select: {
            id: true, handle: true, displayName: true, avatarUrl: true,
            phone: true, createdAt: true,
          },
        },
        Post: { select: { id: true } },
      },
    });

    // ---- Replies to YOUR comments ----
    const repliesToMe = await prisma.comment.findMany({
      where: { parent: { userId: me.id }, userId: { not: me.id } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, createdAt: true, text: true,
        User: {
          select: {
            id: true, handle: true, displayName: true, avatarUrl: true,
            phone: true, createdAt: true,
          },
        },
        Post: { select: { id: true } },
      },
    });

    // ---- Comments on YOUR posts (not replies to you) ----
    const commentsOnMyPosts = await prisma.comment.findMany({
      where: {
        Post: { authorId: me.id },
        userId: { not: me.id },
        OR: [{ parentId: null }, { parent: { userId: { not: me.id } } }],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, createdAt: true, text: true,
        User: {
          select: {
            id: true, handle: true, displayName: true, avatarUrl: true,
            phone: true, createdAt: true,
          },
        },
        Post: { select: { id: true } },
      },
    });

    // ---- Likes on YOUR comments ----
    const commentLikes = await prisma.commentLike.findMany({
      where: { comment: { userId: me.id }, userId: { not: me.id } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        createdAt: true,
        userId: true,
        commentId: true,
        user: {
          select: {
            id: true, handle: true, displayName: true, avatarUrl: true,
            phone: true, createdAt: true,
          },
        },
        comment: { select: { text: true, Post: { select: { id: true } } } },
      },
    });

    // ---- Build unified list ----
    const notis: NotiItem[] = [
      ...follows.map((f) => ({
        id: `follow:${f.id}`,
        kind: 'follow' as const,
        time: f.createdAt.toISOString(),
        user: {
          id: f.follower.id,
          handle: f.follower.handle,
          displayName: f.follower.displayName,
          avatarUrl: f.follower.avatarUrl,
          phoneVerified: !!f.follower.phone,
          createdAt: f.follower.createdAt,
          viewerFollows: iFollowSet.has(f.follower.id),
        },
      })),

      // ✅ Likes jetzt aggregiert (like / like_batch) seit Cursor
      ...likeNotis,

      ...postsWithMention.map((p) => ({
        id: `mention:post:${p.id}`,
        kind: 'mention' as const,
        time: p.createdAt.toISOString(),
        user: {
          id: p.author.id,
          handle: p.author.handle,
          displayName: p.author.displayName,
          avatarUrl: p.author.avatarUrl,
          phoneVerified: !!p.author.phone,
          createdAt: p.author.createdAt,
          viewerFollows: iFollowSet.has(p.author.id),
        },
        text: p.text,
        postId: p.id,
      })),
      ...commentsWithMention.map((c) => ({
        id: `mention:comment:${c.id}`,
        kind: 'mention' as const,
        time: c.createdAt.toISOString(),
        user: {
          id: c.User.id,
          handle: c.User.handle,
          displayName: c.User.displayName,
          avatarUrl: c.User.avatarUrl,
          phoneVerified: !!c.User.phone,
          createdAt: c.User.createdAt,
          viewerFollows: iFollowSet.has(c.User.id),
        },
        text: c.text,
        postId: c.Post.id,
      })),
      ...repliesToMe.map((r) => ({
        id: `reply:${r.id}`,
        kind: 'reply' as const,
        time: r.createdAt.toISOString(),
        user: {
          id: r.User.id,
          handle: r.User.handle,
          displayName: r.User.displayName,
          avatarUrl: r.User.avatarUrl,
          phoneVerified: !!r.User.phone,
          createdAt: r.User.createdAt,
          viewerFollows: iFollowSet.has(r.User.id),
        },
        text: r.text,
        postId: r.Post.id,
      })),
      ...commentsOnMyPosts.map((c) => ({
        id: `comment:${c.id}`,
        kind: 'comment' as const,
        time: c.createdAt.toISOString(),
        user: {
          id: c.User.id,
          handle: c.User.handle,
          displayName: c.User.displayName,
          avatarUrl: c.User.avatarUrl,
          phoneVerified: !!c.User.phone,
          createdAt: c.User.createdAt,
          viewerFollows: iFollowSet.has(c.User.id),
        },
        text: c.text,
        postId: c.Post.id,
      })),
      ...commentLikes.map((cl) => ({
        id: `comment_like:${cl.userId}:${cl.commentId}:${cl.createdAt.getTime()}`,
        kind: 'comment_like' as const,
        time: cl.createdAt.toISOString(),
        user: {
          id: cl.user.id,
          handle: cl.user.handle,
          displayName: cl.user.displayName,
          avatarUrl: cl.user.avatarUrl,
          phoneVerified: !!cl.user.phone,
          createdAt: cl.user.createdAt,
          viewerFollows: iFollowSet.has(cl.user.id),
        },
        text: cl.comment.text,
        postId: cl.comment.Post.id,
      })),
    ];

    const seen = new Set<string>();
    const filtered = notis
      .filter(n => isEnabledKind(n.kind))
      .filter(n => !isMutedByFilters(n.user))
      .filter((n) => {
        if (tab === 'mentions') return n.kind === 'mention';
        if (tab === 'comments') return n.kind === 'comment' || n.kind === 'reply' || n.kind === 'comment_like';
        return true;
      })
      .filter((n) => (seen.has(n.id) ? false : (seen.add(n.id), true)))
      .sort((a, b) => +new Date(b.time) - +new Date(a.time))
      .slice(0, limit);

    // ---- Option B: Cursor "seen until delivered" updaten (für ausgelieferte like/like_batch) ----
    const deliveredLikeActors = new Set(
      filtered
        .filter(n => n.kind === 'like' || n.kind === 'like_batch')
        .map(n => n.user?.id)
        .filter(Boolean) as string[]
    );

    if (deliveredLikeActors.size > 0) {
      const stmts: Array<ReturnType<typeof prisma.$executeRaw>> = [];
      for (const actorId of deliveredLikeActors) {
        const maxTs = maxDeliveredByActor.get(actorId);
        if (!maxTs) continue;

        // Erwartet UNIQUE(recipientId, actorId, kind) auf NotificationSeenCursor
        const cursorId = randomUUID();

        stmts.push(prisma.$executeRaw`
          INSERT INTO "NotificationSeenCursor" ("id","recipientId","actorId","kind","seenUntil")
          VALUES (${cursorId}, ${me.id}, ${actorId}, 'LIKE_POST', ${maxTs})
          ON CONFLICT ("recipientId","actorId","kind")
          DO UPDATE SET "seenUntil" = EXCLUDED."seenUntil"
        `);
      }
      if (stmts.length) {
        await prisma.$transaction(stmts);
      }
    }

    return NextResponse.json(
      { ok: true, items: filtered },
      { headers: { 'cache-control': 'private, no-store' } },
    );
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('notifications GET failed:', err);
    return NextResponse.json({ ok: false, error: 'FAILED' }, { status: 500 });
  }
}
