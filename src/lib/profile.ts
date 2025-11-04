// src/lib/profile.ts
'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Role } from '@prisma/client';


export async function updateProfileAction(formData: FormData) {
  const me = await getCurrentUser();
  if (!me) throw new Error('Not authenticated');

  const displayName = String(formData.get('displayName') ?? '').trim();
  const usernameRaw = String(formData.get('username') ?? '').trim();
  const bio = String(formData.get('bio') ?? '').trim();
  const location = String(formData.get('location') ?? '').trim();
  const roleStr = String(formData.get('role') ?? 'submissive');
  const nsfwDefault = !!formData.get('nsfwDefault');
  const locale = String(formData.get('locale') ?? 'en');
  const websiteUrlRaw = String(formData.get('websiteUrl') ?? '').trim();

  const prismaRole: Role = roleStr === 'domme' ? 'DOMME' : 'SUBMISSIVE';

  const avatarUrlFromClient = formData.get('avatarUrl');
  const bannerUrlFromClient = formData.get('bannerUrl');

  const avatarUrl =
    typeof avatarUrlFromClient === 'string' && avatarUrlFromClient.length > 0
      ? avatarUrlFromClient
      : null;

  const bannerUrl =
    typeof bannerUrlFromClient === 'string' && bannerUrlFromClient.length > 0
      ? bannerUrlFromClient
      : null;

  // Normalize website (store null when empty, cap to 255 chars)
  const websiteUrl =
    websiteUrlRaw.length === 0 ? null : websiteUrlRaw.slice(0, 255);

  const data: Parameters<typeof prisma.user.update>[0]['data'] = {
    handle: usernameRaw.toLowerCase(),
    displayName,
    bio: bio || null,
    location: location || null,
    nsfwDefault,
    role: prismaRole,
    websiteUrl,
  };
  if (avatarUrl !== null) data.avatarUrl = avatarUrl;
  if (bannerUrl !== null) data.bannerUrl = bannerUrl;

  await prisma.user.update({
    where: { id: me.id },
    data,
  });

  revalidatePath('/[locale]/u/[handle]', 'page');
  revalidatePath('/[locale]/settings/profile', 'page');

  redirect(`/${locale}/u/${usernameRaw.toLowerCase()}`);
}
