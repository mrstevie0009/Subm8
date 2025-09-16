// src/app/[locale]/u/[handle]/edit/page.tsx
import { redirect, notFound } from 'next/navigation';
import EditProfileForm, { type EditInitial } from '@/components/EditProfileForm';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { updateProfileAction } from '@/lib/profile';
import EditProfileTabs from '@/components/EditProfileTabs';

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
      id: true,
      handle: true,
      displayName: true,
      bio: true,
      location: true,
      nsfwDefault: true,
      avatarUrl: true,
      bannerUrl: true,
      role: true,
      // 👉 neues Feld für Website-Link
      websiteUrl: true,
    },
  });
  if (!u) notFound();

  // Falls dein EditInitial den Website-Link bereits kennt:
  // (wenn nicht, bitte EditProfileForm/EditInitial + updateProfileAction & Prisma-Schema entsprechend erweitern)
  const initial: EditInitial & { websiteUrl?: string } = {
    displayName: u.displayName ?? '',
    username: u.handle,
    bio: u.bio ?? '',
    location: u.location ?? '',
    role: u.role === 'DOMME' ? 'domme' : 'submissive',
    nsfwDefault: !!u.nsfwDefault,
    avatarUrl: u.avatarUrl ?? undefined,
    bannerUrl: u.bannerUrl ?? undefined,
    websiteUrl: u.websiteUrl ?? '',
  };

  const isDomme = u.role === 'DOMME';

  return (
    <EditProfileTabs
      locale={locale}
      userId={u.id}
      handle={u.handle}
      isDomme={isDomme}
      initial={initial}
      action={updateProfileAction}
      EditFormComponent={EditProfileForm}
    />
  );
}
