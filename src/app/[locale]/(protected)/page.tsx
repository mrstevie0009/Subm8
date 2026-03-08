// src/app/[locale]/(protected)/page.tsx
import HomeFeedClient from '@/components/HomeFeedClient';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { cookies } from 'next/headers';
import type { FeedPost } from '@/components/PostCard';

export const dynamic = 'force-dynamic';

type Params = { locale: string };

type SearchParams = {
  feed?: string;
  role?: string;
};

type ApiMedia = {
  url: string;
  alt?: string | null;
  kind: 'image' | 'video' | 'gif';
  mime?: string | null;
};

type ApiPost = {
  id: string;
  text: string | null;
  mediaUrl: string | null;
  mediaAlt: string | null;
  uploaded?: ApiMedia[];
  createdAt: string;
  _count: { Like: number; Comment: number; reposts: number };
  author: {
    id: string;
    handle: string;
    displayName: string;
    role: 'DOMME' | 'SUBMISSIVE' | null;
    avatarUrl: string | null;
    premiumUntil?: string | null;
    isFirstAdopter?: boolean;
  };
  repostOf: null | {
    id: string;
    text: string;
    mediaUrl: string | null;
    mediaAlt: string | null;
    uploaded?: ApiMedia[];
    createdAt: string;
    author: {
      id: string;
      handle: string;
      displayName: string;
      role: 'DOMME' | 'SUBMISSIVE' | null;
      avatarUrl: string | null;
      premiumUntil?: string | null;
      isFirstAdopter?: boolean;
    };
  };
  quoteOf: null | {
    id: string;
    text: string;
    mediaUrl: string | null;
    mediaAlt: string | null;
    uploaded?: ApiMedia[];
    createdAt: string;
    author: {
      id: string;
      handle: string;
      displayName: string;
      role: 'DOMME' | 'SUBMISSIVE' | null;
      avatarUrl: string | null;
      premiumUntil?: string | null;
      isFirstAdopter?: boolean;
    };
  };
  viewer: {
    liked: boolean;
    bookmarked: boolean;
    hasBlockedAuthor: boolean;
    blockedByAuthor: boolean;
    // optional, falls dein API das schon liefert:
    hasReposted?: boolean;
    commented?: boolean;
    isAuthor?: boolean;
  };
  community?: { name: string; slug: string } | null;
};

function mapApiPostToFeedPost(p: ApiPost): FeedPost {
  const isRepost = !!p.repostOf;

  const content = isRepost
    ? {
        id: p.repostOf!.id,
        text: p.repostOf!.text,
        mediaUrl: p.repostOf!.mediaUrl,
        mediaAlt: p.repostOf!.mediaAlt,
        uploaded: p.repostOf!.uploaded ?? [],
        createdAt: p.repostOf!.createdAt,
        author: {
          id: p.repostOf!.author.id,
          handle: p.repostOf!.author.handle,
          displayName: p.repostOf!.author.displayName,
          role: p.repostOf!.author.role,
          avatarUrl: p.repostOf!.author.avatarUrl,
          premiumUntil: p.repostOf!.author.premiumUntil ?? null,
          isFirstAdopter: !!p.repostOf!.author.isFirstAdopter,
        },
        quote: null,
      }
    : {
        id: p.id,
        text: p.text ?? '',
        mediaUrl: p.mediaUrl,
        mediaAlt: p.mediaAlt,
        uploaded: p.uploaded ?? [],
        createdAt: p.createdAt,
        author: {
          id: p.author.id,
          handle: p.author.handle,
          displayName: p.author.displayName,
          role: p.author.role,
          avatarUrl: p.author.avatarUrl,
          premiumUntil: p.author.premiumUntil ?? null,
          isFirstAdopter: !!p.author.isFirstAdopter,
        },
        quote: p.quoteOf
          ? {
              id: p.quoteOf.id,
              text: p.quoteOf.text,
              mediaUrl: p.quoteOf.mediaUrl,
              mediaAlt: p.quoteOf.mediaAlt,
              uploaded: p.quoteOf.uploaded ?? [],
              createdAt: p.quoteOf.createdAt,
              author: {
                id: p.quoteOf.author.id,
                handle: p.quoteOf.author.handle,
                displayName: p.quoteOf.author.displayName,
                role: p.quoteOf.author.role,
                avatarUrl: p.quoteOf.author.avatarUrl,
                premiumUntil: p.quoteOf.author.premiumUntil ?? null,
                isFirstAdopter: !!p.quoteOf.author.isFirstAdopter,
              },
            }
          : null,
      };

  return {
    id: p.id,
    createdAtISO: p.createdAt,
    content,
    reposter: isRepost
      ? { id: p.author.id, handle: p.author.handle, displayName: p.author.displayName }
      : null,
    stats: {
      comments: p._count.Comment ?? 0,
      reposts: p._count.reposts ?? 0,
      likes: p._count.Like ?? 0,
    },
    viewer: p.viewer,
    initiallyBookmarked: p.viewer.bookmarked,
    community: p.community ?? null,
  };
}

function getBaseUrl() {
  // Empfohlen: setze NEXT_PUBLIC_APP_URL in Vercel auf z.B. https://subm8.com
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) return fromEnv;

  // Vercel Fallback
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;

  // Local dev
  return 'http://localhost:3000';
}

export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams?: Promise<SearchParams>;
}) {
  const { locale } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    const back = `/${locale}`;
    redirect(`/${locale}/signin?callbackUrl=${encodeURIComponent(back)}`);
  }

  const sp = (await searchParams) ?? {};
  const qs = new URLSearchParams();
  if (sp.feed) qs.set('feed', sp.feed);
  if (sp.role) qs.set('role', sp.role);
  qs.set('limit', '12');

  const baseUrl = getBaseUrl();

  // Cookies forwarden, damit /api/feed die Session/Viewer korrekt sieht
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  let initialItems: FeedPost[] = [];
  try {
    const res = await fetch(`${baseUrl}/api/feed?${qs.toString()}`, {
      cache: 'no-store',
      headers: {
        cookie: cookieHeader,
      },
    });

    if (res.ok) {
      const data = (await res.json()) as { posts: ApiPost[] };
      initialItems = (data.posts ?? []).map(mapApiPostToFeedPost);
    }
  } catch {
    // fallback: leer -> Client lädt wie vorher
  }

  return (
    <section className="grid gap-3">
      <HomeFeedClient initialItems={initialItems} />
    </section>
  );
}
