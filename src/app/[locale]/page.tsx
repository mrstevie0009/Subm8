import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import HomeFeedClient from '@/components/HomeFeedClient';
import type { FeedPost } from '@/components/PostCard';

export const dynamic = 'force-dynamic';

type Params = { locale: string };
type JoinPolicy = 'OPEN' | 'INVITE_ONLY' | 'DOMME_ONLY' | 'SUB_ONLY';
type Role = 'DOMME' | 'SUBMISSIVE' | null;

function canSeeCommunity(policy: JoinPolicy, viewerRole: Role, isMember: boolean) {
  if (policy === 'OPEN') return true;
  if (policy === 'INVITE_ONLY') return isMember;
  if (policy === 'DOMME_ONLY') return isMember || viewerRole === 'DOMME';
  if (policy === 'SUB_ONLY') return isMember || viewerRole === 'SUBMISSIVE';
  return false;
}

export default async function HomePage({ params }: { params: Promise<Params> }) {
  await params; // locale wird hier nicht benötigt

  const me = await getCurrentUser().catch(() => null);

  // Rolle ggf. nachladen
  let viewerRole: Role = (me as unknown as { role?: Role } | null)?.role ?? null;
  if (me && viewerRole == null) {
    const row = await prisma.user.findUnique({ where: { id: me.id }, select: { role: true } });
    viewerRole = (row?.role as Role) ?? null;
  }

  const [posts, likedByMe, bookmarkedByMe] = await Promise.all([
    prisma.post.findMany({
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
        repostOf: {
          select: {
            id: true,
            text: true,
            mediaUrl: true,
            mediaAlt: true,
            createdAt: true,
            communityId: true, // ← wichtig für Community-Badge bei Reposts
            author: {
              select: {
                id: true,
                handle: true,
                displayName: true,
                role: true,
                avatarUrl: true,
              },
            },
            _count: { select: { Like: true, Comment: true, reposts: true } },
          },
        },
        quoteOf: {
          select: {
            id: true,
            text: true,
            mediaUrl: true,
            mediaAlt: true,
            createdAt: true,
            author: {
              select: {
                id: true,
                handle: true,
                displayName: true,
                role: true,
                avatarUrl: true,
              },
            },
          },
        },
        _count: { select: { Like: true, Comment: true, reposts: true } },
      },
      take: 30,
    }),
    me
      ? prisma.like.findMany({ where: { userId: me.id }, select: { postId: true } })
      : Promise.resolve([] as { postId: string }[]),
    me
      ? prisma.bookmark.findMany({ where: { userId: me.id }, select: { postId: true } })
      : Promise.resolve([] as { postId: string }[]),
  ]);

  const likedSet = new Set(likedByMe.map((l) => l.postId));
  const bookmarkedSet = new Set(bookmarkedByMe.map((b) => b.postId));

  // Block-Flags
  let hasBlockedSet = new Set<string>();
  let blockedBySet = new Set<string>();
  if (me) {
    const feedAuthorIds = Array.from(new Set(posts.map((p) => p.author.id)));
    if (feedAuthorIds.length > 0) {
      const [myBlocks, blocksMe] = await Promise.all([
        prisma.block.findMany({
          where: { blockerId: me.id, blockedId: { in: feedAuthorIds } },
          select: { blockedId: true },
        }),
        prisma.block.findMany({
          where: { blockerId: { in: feedAuthorIds }, blockedId: me.id },
          select: { blockerId: true },
        }),
      ]);
      hasBlockedSet = new Set(myBlocks.map((b) => b.blockedId));
      blockedBySet = new Set(blocksMe.map((b) => b.blockerId));
    }
  }

  // Effektive Community je Post: eigener Community-Bezug oder der des Originals bei Reposts
  const effectiveCommunityId = (p: typeof posts[number]) =>
    p.communityId ?? p.repostOf?.communityId ?? null;

  // Communities + Visibility filtern
  const communityIds = Array.from(
    new Set(posts.map(effectiveCommunityId).filter(Boolean) as string[])
  );
  const communities = communityIds.length
    ? await prisma.community.findMany({
        where: { id: { in: communityIds } },
        select: { id: true, name: true, slug: true, joinPolicy: true },
      })
    : [];
  const commById = new Map(communities.map((c) => [c.id, c]));

  const memberSet =
    me && communityIds.length
      ? new Set(
          (
            await prisma.communityMember.findMany({
              where: { userId: me.id, communityId: { in: communityIds } },
              select: { communityId: true },
            })
          ).map((m) => m.communityId)
        )
      : new Set<string>();

  const visible = posts.filter((p) => {
    const cid = effectiveCommunityId(p);
    if (!cid) return true;
    const c = commById.get(cid);
    if (!c) return false;
    return canSeeCommunity(c.joinPolicy as JoinPolicy, viewerRole, memberSet.has(c.id));
  });

  const items: FeedPost[] = visible.map((p) => {
    const isRepost = !!p.repostOf;
    const isQuote = !!p.quoteOf;

    const content = isRepost
      ? {
          id: p.repostOf!.id,
          text: p.repostOf!.text ?? '',
          mediaUrl: p.repostOf!.mediaUrl,
          mediaAlt: p.repostOf!.mediaAlt,
          createdAt: p.repostOf!.createdAt.toISOString(),
          author: {
            id: p.repostOf!.author.id,
            handle: p.repostOf!.author.handle,
            displayName: p.repostOf!.author.displayName,
            role: p.repostOf!.author.role,
            avatarUrl: p.repostOf!.author.avatarUrl,
          },
          quote: null,
        }
      : {
          id: p.id,
          text: p.text ?? '',
          mediaUrl: p.mediaUrl,
          mediaAlt: p.mediaAlt,
          createdAt: p.createdAt.toISOString(),
          author: {
            id: p.author.id,
            handle: p.author.handle,
            displayName: p.author.displayName,
            role: p.author.role,
            avatarUrl: p.author.avatarUrl,
          },
          quote: isQuote
            ? {
                id: p.quoteOf!.id,
                text: p.quoteOf!.text ?? '',
                mediaUrl: p.quoteOf!.mediaUrl,
                mediaAlt: p.quoteOf!.mediaAlt,
                createdAt: p.quoteOf!.createdAt.toISOString(),
                author: {
                  id: p.quoteOf!.author.id,
                  handle: p.quoteOf!.author.handle,
                  displayName: p.quoteOf!.author.displayName,
                  role: p.quoteOf!.author.role,
                  avatarUrl: p.quoteOf!.author.avatarUrl,
                },
              }
            : null,
        };

    const statSource = isRepost ? p.repostOf! : p;
    const viewerTargetId = isRepost ? p.repostOf!.id : p.id;
    const cid = effectiveCommunityId(p);
    const community = cid ? commById.get(cid) ?? null : null;

    return {
      id: p.id,
      createdAtISO: p.createdAt.toISOString(),
      content,
      reposter: isRepost ? { id: p.author.id, handle: p.author.handle, displayName: p.author.displayName } : null,
      stats: {
        comments: statSource._count.Comment ?? 0,
        reposts: statSource._count.reposts ?? 0,
        likes: statSource._count.Like ?? 0,
      },
      viewer: {
        liked: likedSet.has(viewerTargetId),
        bookmarked: bookmarkedSet.has(viewerTargetId),
        hasBlockedAuthor: me ? hasBlockedSet.has(p.author.id) : false,
        blockedByAuthor: me ? blockedBySet.has(p.author.id) : false,
      },
      initiallyBookmarked: bookmarkedSet.has(viewerTargetId),
      community: community ? { name: community.name, slug: community.slug } : null,
    } satisfies FeedPost;
  });

  return <HomeFeedClient initialItems={items} />;
}
