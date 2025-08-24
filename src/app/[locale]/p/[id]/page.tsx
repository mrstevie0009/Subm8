// src/app/[locale]/p/[id]/page.tsx
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { relativeTime } from '@/lib/relativeTime';
import type { Role } from '@prisma/client';
import PostCard, { type Post as PostCardPost } from '@/components/PostCard';

type Params = { locale: string; id: string };

function toUiRole(role: Role): 'domme' | 'submissive' {
  return role === 'DOMME' ? 'domme' : 'submissive';
}

export default async function PostDetailPage({
  params,
}: { params: Promise<Params> }) {
  const { locale, id } = await params;

  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      author: true,
      Comment: {
        include: { User: true },
        orderBy: { createdAt: 'asc' },
      },
      Like: true, // falls du später likes zählen willst
      bookmarks: false,
    },
  });

  // ✅ if-Block statt Kurzschluss-Expression (fix für no-unused-expressions)
  if (!post) {
    notFound();
  }

  // Post für PostCard (Client-Komponente) mappen
  const postForCard: PostCardPost = {
    id: post.id,
    author: {
      name: post.author.displayName,
      role: toUiRole(post.author.role),
      handle: post.author.handle,
      avatarUrl: post.author.avatarUrl ?? undefined,
    },
    createdAt: relativeTime(post.createdAt, locale),
    text: post.text,
    mediaUrl: post.mediaUrl ?? undefined,
    mediaAlt: post.mediaAlt ?? undefined,
    stats: {
      comments: post.Comment.length,
      reposts: 0,
      likes: 0,
    },
    initiallyBookmarked: false, // wenn du willst: via Query für aktuellen User setzen
    viewer: { liked: false },   // optional
  };

  return (
    <section className="max-w-2xl mx-auto grid gap-4">
      {/* Header mit Zurück-Pfeil – locale wird benutzt (fix für unused var) */}
      <header className="sticky top-[calc(var(--header-h))] z-10 bg-black/70 backdrop-blur border-b border-white/10">
        <div className="px-3 py-2 flex items-center gap-2">
          <Link
            href={`/${locale}`}
            className="inline-flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 6l-6 6 6 6" />
            </svg>
            <span className="text-sm">Back</span>
          </Link>
          <div className="ml-2 text-sm opacity-70 truncate">Post</div>
        </div>
      </header>

      {/* Der Post (interaktiv via PostCard) */}
      <PostCard post={postForCard} />

      {/* Kommentare */}
      <section className="rounded-app border border-sub shadow-app">
        <header className="px-4 py-3 border-b border-white/10 font-semibold">
          Comments ({post.Comment.length})
        </header>

        {post.Comment.length === 0 ? (
          <div className="px-4 py-8 text-center opacity-70">
            No comments yet.
          </div>
        ) : (
          <ul className="divide-y divide-white/10">
            {post.Comment.map((c) => (
              <li key={c.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <Image
                    src={c.User.avatarUrl ?? '/images/avatar-placeholder.png'}
                    alt=""
                    width={36}
                    height={36}
                    className="rounded-full object-cover border border-white/15"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium truncate">{c.User.displayName}</span>
                      <span className="opacity-70 truncate">@{c.User.handle}</span>
                      <span className="opacity-50">
                        · {relativeTime(c.createdAt, locale)}
                      </span>
                    </div>
                    <div className="mt-1 whitespace-pre-wrap break-words">
                      {c.text}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
