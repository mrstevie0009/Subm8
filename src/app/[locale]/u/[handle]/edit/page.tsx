// src/app/[locale]/u/[handle]/edit/page.tsx
import { redirect, notFound } from 'next/navigation';
import EditProfileForm, { type EditInitial } from '@/components/EditProfileForm';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { updateProfileAction } from '@/lib/profile';
import Link from 'next/link';

export default async function Page({
  params: { locale, handle },
}: {
  params: { locale: string; handle: string };
}) {
  const me = await getCurrentUser();
  if (!me) {
    redirect(`/${locale}/signin?callbackUrl=/${locale}/u/${handle}/edit`);
  }

  const owner = await prisma.user.findUnique({
    where: { handle: handle.toLowerCase() },
    select: { id: true },
  });
  if (!owner) notFound();

  if (owner.id !== me.id) {
    redirect(`/${locale}/u/${handle}`);
  }

  const u = await prisma.user.findUnique({
    where: { id: me.id },
    select: {
      handle: true,
      displayName: true,
      bio: true,
      location: true,
      nsfwDefault: true,
      avatarUrl: true,
      bannerUrl: true,
      role: true,
    },
  });
  if (!u) notFound();

  const initial: EditInitial = {
    displayName: u.displayName ?? '',
    username: u.handle,
    bio: u.bio ?? '',
    location: u.location ?? '',
    role: u.role === 'DOMME' ? 'domme' : 'submissive',
    nsfwDefault: !!u.nsfwDefault,
    avatarUrl: u.avatarUrl ?? undefined,
    bannerUrl: u.bannerUrl ?? undefined,
  };

  return (
    <EditProfileForm
      locale={locale}
      initial={initial}
      action={updateProfileAction}
      /* ⬇️ Button direkt unter dem Username-Feld */
      renderUnderUsername={
        <Link
          href={`/${locale}/u/${handle}/offers`}
          className="inline-flex items-center gap-2 rounded-md border border-white/12 px-3 py-1.5 hover:bg-white/5 text-sm"
          prefetch={false}
        >
          {/* kleines Geschenk-Icon als Offer-Hinweis */}
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <rect x="7.5" y="9" width="9" height="2.6" rx="0.8" />
            <rect x="8" y="11" width="8" height="6" rx="1.2" />
            <line x1="12" y1="9" x2="12" y2="17" />
            <path d="M12 9c-1-2-4-2-4 0" strokeLinecap="round" />
            <path d="M12 9c1-2 4-2 4 0"  strokeLinecap="round" />
          </svg>
          Edit Offer Menu
        </Link>
      }
    />
  );
}
