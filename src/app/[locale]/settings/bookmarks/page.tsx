// src/app/[locale]/settings/bookmarks/page.tsx
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import type { Role } from '@prisma/client';
import PostCard, { type Post as UIPost } from '@/components/PostCard';

type Params = { locale: string };

// Kompaktes Typ-Shape für die Abfrage
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
      handle: string;
      displayName: string | null;
      avatarUrl: string | null;
      role: Role;
    };
  };
};

export default async function BookmarksPage({ params }: { params: Params }) {
  const { locale } = params;

  // Aktuellen User holen (mit id!)
  const me = await getCurrentUser();
  const handle = me?.handle ?? '—';

  // Gemeinsamer Header (Back nach Feed + Handle)
  const Header = (
    <header className="px-4 pt-3 pb-4 border-b border-white/10">
      <div className="flex items-center">
        <Link
          href={`/${locale}`}
          aria-label="Zurück zum Feed"
          className="inline-flex items-center justify-center p-1 hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
          style={{ color: 'var(--purple)' }}
        >
          <ChevronLeftIcon />
        </Link>

        <div className="ml-2 sm:ml-3">
          <h1 className="text-[22px] font-bold leading-tight">Bookmarks</h1>
          <div className="text-sm text-white/60">@{handle}</div>
        </div>
      </div>
    </header>
  );

  // Wenn nicht eingeloggt → leerer Zustand
  if (!me) {
    return (
      <section className="rounded-app border border-sub overflow-hidden shadow-app">
        {Header}
        <div className="p-10 md:p-14">
          <h2 className="text-[28px] md:text-[36px] font-extrabold leading-tight mb-3">
            Save posts for later
          </h2>
          <p className="text-white/70 text-[15px] md:text-[17px]">
            Add bookmarks to posts so you can easily find them again in the future.
          </p>
        </div>
      </section>
    );
  }

  // Bookmarks laden
  const rows = (await prisma.bookmark.findMany({
    where: { userId: me.id },
    orderBy: { createdAt: 'desc' },
    include: { post: { include: { author: true } } },
  })) as unknown as BookmarkRow[];

  // Leerzustand (eingeloggt, aber keine Bookmarks)
  if (rows.length === 0) {
    return (
      <section className="rounded-app border border-sub overflow-hidden shadow-app">
        {Header}
        <div className="p-10 md:p-14">
          <h2 className="text-[28px] md:text-[36px] font-extrabold leading-tight mb-3">
            Save posts for later
          </h2>
          <p className="text-white/70 text-[15px] md:text-[17px]">
            Add bookmarks to posts so you can easily find them again in the future.
          </p>
        </div>
      </section>
    );
  }

  // In UI-Posts mappen
  const posts: UIPost[] = rows.map((b) => {
    const p = b.post;
    const a = p.author;
    const roleUI: 'domme' | 'submissive' = a.role === 'DOMME' ? 'domme' : 'submissive';
    return {
      id: p.id,
      author: {
        name: a.displayName ?? a.handle,
        handle: a.handle,
        role: roleUI,
        avatarUrl: a.avatarUrl ?? undefined,
      },
      createdAt: p.createdAt.toISOString(),
      text: p.text ?? '',
      mediaUrl: p.mediaUrl ?? undefined,
      mediaAlt: p.mediaAlt ?? undefined,
      stats: { comments: 0, reposts: 0, likes: 0 },
      initiallyBookmarked: true,
    };
  });

  return (
    <section className="rounded-app border border-sub overflow-hidden shadow-app">
      {Header}
      <div className="divide-y divide-white/10">
        {posts.map((post) => (
          <div key={post.id} className="p-4">
            <PostCard post={post} />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ===== Icons ===== */
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
