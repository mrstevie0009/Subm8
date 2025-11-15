// src/app/[locale]/settings/bookmarks/page.tsx
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import type { Role } from '@prisma/client';
import PostCard, { type FeedPost } from '@/components/PostCard';
import BackButton from '@/components/BackButtonStandard';
import { createTranslator } from 'next-intl';
import { notFound } from 'next/navigation';
import React from 'react';

type Params = { locale: string };

type BookmarkRow = {
  id: string;
  createdAt: Date;
  post: {
    id: string;
    text: string | null;
    mediaUrl: string | null;
    mediaAlt: string | null;
    createdAt: Date;
    author: {
      id: string;
      handle: string;
      displayName: string | null;
      avatarUrl: string | null;
      role: Role;
    };
  };
};

export default async function BookmarksPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;

  // Messages aus home.json laden (Namespace = "home")
  let t: ReturnType<typeof createTranslator>;
  try {
    const homeFile = (await import(`@/messages/${locale}/home.json`)).default;
    t = createTranslator({ locale, messages: { home: homeFile }, namespace: 'home' });
  } catch {
    notFound();
  }

  const me = await getCurrentUser();
  const handle = me?.handle ?? '—';

  const Header = (
    <header className="px-4 pt-3 pb-4 border-b border-white/10">
      <div className="flex items-center">
        <BackButton
          fallbackHref={`/${locale}`}
          ariaLabel={t('bookmarksPage.ariaBack')}
          className="inline-flex items-center justify-center p-1 hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
          style={{ color: 'var(--purple)' }}
        >
          <ChevronLeftIcon />
        </BackButton>
        <div className="ml-2 sm:ml-3">
          <h1 className="text-[22px] font-bold leading-tight">{t('bookmarksPage.title')}</h1>
          <div className="text-sm text-white/60">@{handle}</div>
        </div>
      </div>
    </header>
  );

  if (!me) {
    return (
      <Viewport>
        <section className="mx-auto max-w-3xl rounded-app border border-sub overflow-hidden shadow-app">
          {Header}
          <div className="p-10 md:p-14">
            <h2 className="text-[28px] md:text-[36px] font-extrabold leading-tight mb-3">
              {t('bookmarksPage.guestTitle')}
            </h2>
            <p className="text-white/70 text-[15px] md:text-[17px]">
              {t('bookmarksPage.guestDesc')}
            </p>
          </div>
        </section>
      </Viewport>
    );
  }

  const rows = (await prisma.bookmark.findMany({
    where: { userId: me.id },
    orderBy: { createdAt: 'desc' },
    include: { post: { include: { author: true } } },
  })) as unknown as BookmarkRow[];

  if (rows.length === 0) {
    return (
      <Viewport>
        <section className="mx-auto max-w-3xl rounded-app border border-sub overflow-hidden shadow-app">
          {Header}
          <div className="p-10 md:p-14">
            <h2 className="text-[28px] md:text-[36px] font-extrabold leading-tight mb-3">
              {t('bookmarksPage.emptyTitle')}
            </h2>
            <p className="text-white/70 text-[15px] md:text-[17px]">
              {t('bookmarksPage.emptyDesc')}
            </p>
          </div>
        </section>
      </Viewport>
    );
  }

  const posts: FeedPost[] = rows.map((b) => {
    const p = b.post;
    const a = p.author;
    return {
      id: p.id,
      createdAtISO: p.createdAt.toISOString(),
      content: {
        id: p.id,
        text: p.text ?? '',
        mediaUrl: p.mediaUrl ?? null,
        mediaAlt: p.mediaAlt ?? null,
        createdAt: p.createdAt.toISOString(),
        author: {
          id: a.id,
          handle: a.handle,
          displayName: a.displayName ?? a.handle,
          role: a.role,
          avatarUrl: a.avatarUrl,
        },
        quote: null,
      },
      reposter: null,
      stats: { comments: 0, reposts: 0, likes: 0 },
      viewer: { liked: false, bookmarked: true, hasBlockedAuthor: false, blockedByAuthor: false },
      initiallyBookmarked: true,
      community: null,
    };
  });

  return (
    <Viewport>
      <section className="mx-auto max-w-3xl rounded-app border border-sub overflow-hidden shadow-app">
        {Header}
        <div className="divide-y divide-white/10">
          {posts.map((post) => (
            <div key={post.id} className="p-4">
              <PostCard post={post} />
            </div>
          ))}
        </div>
      </section>
    </Viewport>
  );
}

/** Vollbild-Wrapper: Hintergrund füllt die Seite; Scrollen nur im Inhalt */
function Viewport({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-0 bg-black bg-gradient-to-b from-black to-[#0b0b0b]">
      <div className="h-full overflow-y-auto overscroll-contain">
        <div className="px-3 sm:px-4 py-4 sm:py-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  );
}

function ChevronLeftIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      aria-hidden="true"
    >
      <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
