'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { promises as fs } from 'fs';
import path from 'path';
import { Role } from '@prisma/client';

/**
 * Save an uploaded File to /public/uploads/{dir}/<uuid>.<ext>
 * Returns the public URL (e.g. "/uploads/avatars/abc123.png")
 */
async function saveFile(file: File, dir: 'avatars' | 'banners'): Promise<string> {
  const uploadsRoot = path.join(process.cwd(), 'public', 'uploads', dir);
  await fs.mkdir(uploadsRoot, { recursive: true });

  const mime = file.type || 'image/png';
  const ext = mime.split('/')[1]?.toLowerCase() || 'png';

  const filename = `${crypto.randomUUID()}.${ext}`;
  const full = path.join(uploadsRoot, filename);

  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(full, buf);

  return `/uploads/${dir}/${filename}`;
}

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

  const prismaRole: Role = roleStr === 'domme' ? 'DOMME' : 'SUBMISSIVE';

  let avatarUrl: string | null = null;
  let bannerUrl: string | null = null;

  const avatar = formData.get('avatar');
  if (avatar instanceof File && avatar.size > 0) {
    avatarUrl = await saveFile(avatar, 'avatars');
  }

  const banner = formData.get('banner');
  if (banner instanceof File && banner.size > 0) {
    bannerUrl = await saveFile(banner, 'banners');
  }

  const data: Parameters<typeof prisma.user.update>[0]['data'] = {
    handle: usernameRaw.toLowerCase(),
    displayName,
    bio: bio || null,
    location: location || null,
    nsfwDefault,
    role: prismaRole,
  };
  if (avatarUrl !== null) data.avatarUrl = avatarUrl;
  if (bannerUrl !== null) data.bannerUrl = bannerUrl;

  await prisma.user.update({
    where: { id: me.id },
    data,
  });

  // Revalidate affected pages
  revalidatePath('/[locale]/u/[handle]', 'page');
  revalidatePath('/[locale]/settings/profile', 'page');

  // Redirect to the (possibly changed) profile URL
  redirect(`/${locale}/u/${usernameRaw.toLowerCase()}`);
}
