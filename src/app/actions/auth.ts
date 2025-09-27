//src/app/actions/auth.ts
'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';

// Hilfsfunktionen
function normEmail(v: string) {
  return v.trim().toLowerCase();
}
function validHandle(v: string) {
  return /^[a-z0-9_.]{3,20}$/.test(v);
}

export async function registerUser(formData: FormData): Promise<void> {
  const displayNameRaw = (formData.get('displayName') as string | null) ?? '';
  const handleRaw = (formData.get('handle') as string | null) ?? '';
  const emailRaw = (formData.get('email') as string | null) ?? '';
  const password = (formData.get('password') as string | null) ?? '';
  const password2 = (formData.get('password2') as string | null) ?? '';

  const displayName = displayNameRaw.trim().slice(0, 40); // DB: VarChar(40)
  const handle = handleRaw.trim().toLowerCase();          // DB: VarChar(20), unique
  const email = normEmail(emailRaw);

  // Basis-Validierung
  if (!email || !password) {
    redirect(`/signup?error=${encodeURIComponent('E-Mail und Passwort erforderlich')}`);
  }
  if (password !== password2) {
    redirect(`/signup?error=${encodeURIComponent('Passwörter stimmen nicht überein')}&email=${encodeURIComponent(email)}`);
  }
  if (!handle || !validHandle(handle)) {
    redirect(`/signup?error=${encodeURIComponent('Handle ungültig (3–20 Zeichen, a-z 0-9 _ .)')}&email=${encodeURIComponent(email)}`);
  }
  if (!displayName) {
    redirect(`/signup?error=${encodeURIComponent('Anzeigename erforderlich')}&email=${encodeURIComponent(email)}`);
  }

  // Uniqueness prüfen (E-Mail ODER Handle bereits vergeben?)
  const exists = await prisma.user.findFirst({
    where: { OR: [{ email }, { handle }] },
    select: { id: true, email: true, handle: true },
  });
  if (exists) {
    redirect(`/signup?error=${encodeURIComponent('E-Mail oder Handle bereits vergeben')}&email=${encodeURIComponent(email)}`);
  }

  const passwordHash = await hashPassword(password);

  // Default-Rolle setzen (anpassbar)
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      handle,
      displayName,
      role: 'SUBMISSIVE',
      // avatarUrl/bannerUrl optional
    },
  });

  // Nach erfolgreicher Registrierung zur Sign-in-Seite (mit Pre-Fill)
  redirect(`/signin?registered=1&email=${encodeURIComponent(email)}`);
}
