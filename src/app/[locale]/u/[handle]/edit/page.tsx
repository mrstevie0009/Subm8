import { redirect, notFound } from 'next/navigation';
import EditProfileForm, { type EditInitial } from '@/components/EditProfileForm';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { updateProfileAction } from '@/lib/profile';

export default async function Page({
  params: { locale, handle },
}: {
  params: { locale: string; handle: string };
}) {
  const me = await getCurrentUser();
  if (!me) {
    redirect(`/${locale}/signin?callbackUrl=/${locale}/u/${handle}/edit`);
  }

  // Profil-Besitzer zum Handle ermitteln (nur id nötig)
  const owner = await prisma.user.findUnique({
    where: { handle: handle.toLowerCase() },
    select: { id: true },
  });
  if (!owner) notFound();

  // Nur Besitzer darf editieren
  if (owner.id !== me.id) {
    redirect(`/${locale}/u/${handle}`);
  }

  // Alle Initialwerte laden
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
    nsfwDefault: !!u.nsfwDefault,
    avatarUrl: u.avatarUrl ?? undefined,
    bannerUrl: u.bannerUrl ?? undefined,
  };

  return (
    <EditProfileForm
      locale={locale}
      initial={initial}
      action={updateProfileAction}
    />
  );
}
