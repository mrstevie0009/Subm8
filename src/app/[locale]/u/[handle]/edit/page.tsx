import { redirect, notFound } from 'next/navigation';
import EditProfileForm, { type EditInitial } from '@/components/EditProfileForm';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; handle: string }>;
}) {
  const { locale, handle } = await params;

  const me = await getCurrentUser();
  if (!me) {
    redirect(`/${locale}/signin?callbackUrl=/${locale}/u/${handle}/edit`);
  }

  // Profil zum Handle finden
  const owner = await prisma.user.findUnique({
    where: { handle: handle.toLowerCase() },
    select: { id: true },
  });
  if (!owner) notFound();

  // Nur Besitzer darf editieren
  if (owner.id !== me.id) {
    redirect(`/${locale}/u/${handle}`);
  }

  // Initialwerte laden
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
      role: true, // 'DOMME' | 'SUBMISSIVE'
    },
  });
  if (!u) notFound();

  const initial: EditInitial = {
    displayName: u.displayName ?? '',
    username: u.handle,
    bio: u.bio ?? '',
    location: u.location ?? '',
    role: u.role === 'DOMME' ? 'domme' : 'submissive',
    nsfwDefault: u.nsfwDefault ?? false,
    avatarUrl: u.avatarUrl ?? undefined,
    bannerUrl: u.bannerUrl ?? undefined,
  };

  return (
    <div className="max-w-3xl mx-auto p-4">
      <EditProfileForm locale={locale} initial={initial} />
    </div>
  );
}
