import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import type { Role } from '@prisma/client';
import { relativeTime } from '@/lib/relativeTime';
import type { Post as PostCardPost } from '@/components/PostCard';
import CommunityJoinButton from '@/components/CommunityJoinButton';
import CommunityComposer from '@/components/CommunityComposer';
import BackButton from '@/components/BackButton';
import { notFound } from 'next/navigation';
import CommunityCompactHeader from '@/components/CommunityCompactHeader';
import CommunityFeedClient from '@/components/CommunityFeedClient';

type Params = { locale: string; slug: string };

function toUiRole(role: Role): 'domme' | 'submissive' {
  return role === 'DOMME' ? 'domme' : 'submissive';
}

type FeedPost = PostCardPost & { createdAtISO: string };

export default async function CommunityPage({ params }: { params: Promise<Params> }) {
  const { locale, slug } = await params;
  const me = await getCurrentUser().catch(() => null);

  const community = await prisma.community.findUnique({
    where: { slug: slug.toLowerCase() },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      joinPolicy: true,
      bannerUrl: true,
      _count: { select: { CommunityMember: true } },
    },
  });

  if (!community) notFound();

  const joined = me
    ? !!(await prisma.communityMember.findUnique({
        where: { communityId_userId: { communityId: community.id, userId: me.id } },
        select: { communityId: true },
      }))
    : false;

  const posts = await prisma.post.findMany({
    where: { communityId: community.id },
    orderBy: { createdAt: 'desc' },
    include: {
      author: {
        select: {
          displayName: true,
          handle: true,
          role: true,
          avatarUrl: true,
        },
      },
      _count: { select: { Like: true, Comment: true } },
    },
    take: 30,
  });

  const items: FeedPost[] = posts.map((p) => ({
    id: p.id,
    author: {
      name: p.author.displayName,
      role: toUiRole(p.author.role),
      handle: p.author.handle,
      avatarUrl: p.author.avatarUrl ?? undefined,
    },
    createdAt: relativeTime(p.createdAt, locale),
    createdAtISO: p.createdAt.toISOString(),
    text: p.text,
    mediaUrl: p.mediaUrl ?? undefined,
    mediaAlt: p.mediaAlt ?? undefined,
    stats: {
      comments: p._count.Comment ?? 0,
      reposts: 0,
      likes: p._count.Like ?? 0,
    },
  }));

  return (
    <section className="grid gap-4 max-w-2xl mx-auto">
      {/* --- GROSSER HEADER --- */}
      <header className="rounded-app border border-sub shadow-app p-4 overflow-hidden">
        {community.bannerUrl && (
          <div className="-mx-4 -mt-4 mb-3 h-28 relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={community.bannerUrl} alt="" className="object-cover w-full h-full" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/0 to-black/30" />
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          {/* Links: Back + Texte */}
          <div className="min-w-0 relative pl-10">
            <div className="absolute left-0 top-0.5">
              <BackButton fallbackHref={`/${locale}/communities`} />
            </div>

            <div className="text-xl font-bold truncate">{community.name}</div>
            <div className="text-sm opacity-70 truncate">@{community.slug}</div>
            {community.description && (
              <p className="mt-1 text-sm opacity-90">{community.description}</p>
            )}
            <div className="mt-2 text-sm opacity-80">
              {community._count.CommunityMember.toLocaleString()} members · Policy:{' '}
              <span className="uppercase">{community.joinPolicy}</span>
            </div>
          </div>

          <CommunityJoinButton
            slug={community.slug}
            initialJoined={joined}
            initialMembers={community._count.CommunityMember}
          />
        </div>
      </header>

      {/* Compact Header (fixed, blendet ein beim Scrollen) */}
      <CommunityCompactHeader
        locale={locale}
        name={community.name}
        slug={community.slug}
        initialJoined={joined}
        initialMembers={community._count.CommunityMember}
      />

      {/* Composer – nur wenn Mitglied */}
      {joined && (
        <div className="rounded-app border border-sub shadow-app p-4">
          <CommunityComposer slug={community.slug} />
        </div>
      )}

      {/* FEED + New-Posts-Button (Client) */}
      <CommunityFeedClient initialItems={items} locale={locale} slug={community.slug} />
    </section>
  );
}
