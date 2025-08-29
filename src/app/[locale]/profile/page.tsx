// src/app/[locale]/profile/page.tsx
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';

import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import { getCurrentUser } from '@/lib/currentUser';
import type { User} from '@prisma/client';

type Params = { locale: string };

export const dynamic = 'force-dynamic';

/* =========================
   DB-Feld-Erkennung
========================= */

async function getUserColumnFlags() {
  const cols = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User'
  `;
  const set = new Set(cols.map((c) => c.column_name));
  return {
    hasPhone: set.has('phone'),
    hasCountry: set.has('country'),
    hasIsDeactivated: set.has('isDeactivated'),
  };
}

/* =========================
   Auth-Helper
========================= */

type AuthedUser = Pick<User, 'id' | 'handle' | 'role' | 'passwordHash'> & {
  isDeactivated?: boolean;
};

async function requireUser(): Promise<{ user: AuthedUser }> {
  const me = await getCurrentUser().catch(() => null);
  if (!me) throw new Error('Not authenticated');

  // Basisdaten (Spalten, die sicher existieren)
  const base = await prisma.user.findUnique({
    where: { id: me.id },
    select: { id: true, handle: true, role: true, passwordHash: true },
  });
  if (!base) throw new Error('User not found');

  // isDeactivated nur lesen, wenn Spalte vorhanden ist
  const { hasIsDeactivated } = await getUserColumnFlags();
  let isDeactivated = false;
  if (hasIsDeactivated) {
    const row = await prisma.$queryRaw<{ isDeactivated: boolean }[]>`
      SELECT "isDeactivated" FROM "User" WHERE id = ${base.id} LIMIT 1
    `;
    isDeactivated = row[0]?.isDeactivated ?? false;
    if (isDeactivated) throw new Error('Account is deactivated');
  }

  return { user: { ...base, isDeactivated } };
}

/* =========================
   Validierung
========================= */

function normEmail(v: string) {
  return v.trim().toLowerCase();
}
function validHandle(v: string) {
  return /^[a-z0-9_.]{3,20}$/.test(v);
}
function validISO2Country(v: string) {
  return /^[A-Za-z]{2}$/.test(v);
}

/* =========================
   Server Actions
========================= */

export async function updateProfileAction(formData: FormData) {
  'use server';
  const { user } = await requireUser();
  const { hasPhone, hasCountry } = await getUserColumnFlags();

  const handleRaw = (formData.get('handle') ?? '').toString().trim().toLowerCase();
  const emailRaw = (formData.get('email') ?? '').toString();
  const phoneRaw = (formData.get('phone') ?? '').toString().trim();
  const countryRaw = (formData.get('country') ?? '').toString().trim();

  if (!handleRaw || !validHandle(handleRaw)) {
    throw new Error('Handle ungültig (3–20 Zeichen, a-z 0–9 _ .)');
  }

  const email = emailRaw ? normEmail(emailRaw) : null;
  const country = countryRaw ? countryRaw.toUpperCase() : null;

  if (country && !validISO2Country(country)) {
    throw new Error('Land muss ISO-2 sein (z. B. DE, AT, US).');
  }

  // Uniqueness
  const handleClash = await prisma.user.findFirst({
    where: { handle: handleRaw, NOT: { id: user.id } },
    select: { id: true },
  });
  if (handleClash) throw new Error('Handle ist bereits vergeben.');

  if (email) {
    const emailClash = await prisma.user.findFirst({
      where: { email, NOT: { id: user.id } },
      select: { id: true },
    });
    if (emailClash) throw new Error('E-Mail ist bereits vergeben.');
  }

  // Update-Daten dynamisch nur mit vorhandenen Spalten
  const data: {
    handle: string;
    email: string | null;
    phone?: string | null;
    country?: string | null;
  } = {
    handle: handleRaw,
    email,
  };
  if (hasPhone) data.phone = phoneRaw || null;
  if (hasCountry) data.country = country || null;

  await prisma.user.update({
    where: { id: user.id },
    data,
  });

  revalidatePath('/[locale]/profile', 'page');
}

export async function changePasswordAction(formData: FormData) {
  'use server';
  const { user } = await requireUser();

  const currentPassword = (formData.get('currentPassword') ?? '').toString();
  const newPassword = (formData.get('newPassword') ?? '').toString();
  const newPassword2 = (formData.get('newPassword2') ?? '').toString();

  if (!user.passwordHash) {
    throw new Error('Dieses Konto unterstützt keine Passwort-Änderung.');
  }
  if (newPassword.length < 8) throw new Error('Neues Passwort muss mind. 8 Zeichen haben.');
  if (newPassword !== newPassword2) throw new Error('Passwörter stimmen nicht überein.');

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw new Error('Aktuelles Passwort ist falsch.');

  const hash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hash },
  });

  revalidatePath('/[locale]/profile', 'page');
}

export async function deactivateAccountAction() {
  'use server';
  const { user } = await requireUser();
  const { hasIsDeactivated } = await getUserColumnFlags();

  if (!hasIsDeactivated) {
    throw new Error(
      'Deaktivieren nicht möglich: Spalte "isDeactivated" fehlt in der DB. Bitte Migration ausführen.'
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { isDeactivated: true },
  });

  await prisma.session.deleteMany({ where: { userId: user.id } }).catch(() => {});

  const jar = await cookies();
  const expire = { expires: new Date(0), httpOnly: true, path: '/' as const };
  jar.set('sessionToken', '', expire);
  jar.set('next-auth.session-token', '', expire);
  jar.set('__Secure-next-auth.session-token', '', expire);

  redirect('/');
}

export async function logoutAction() {
  'use server';
  const jar = await cookies();
  const token =
    jar.get('sessionToken')?.value ||
    jar.get('next-auth.session-token')?.value ||
    jar.get('__Secure-next-auth.session-token')?.value ||
    null;

  if (token) {
    await prisma.session.delete({ where: { sessionToken: token } }).catch(() => {});
  }

  const expire = { expires: new Date(0), httpOnly: true, path: '/' as const };
  jar.set('sessionToken', '', expire);
  jar.set('next-auth.session-token', '', expire);
  jar.set('__Secure-next-auth.session-token', '', expire);

  redirect('/signin');
}

/* =========================
   Page Component (Server)
========================= */

export default async function SettingsPage({ params }: { params: Params }) {
  const { locale } = params;

  const me = await getCurrentUser().catch(() => null);
  if (!me) {
    return (
      <section className="rounded-xl border border-white/10 overflow-hidden">
        <header className="px-4 pt-3 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Link href={`/${locale}/settings`} className="p-1" aria-label="Zurück">
              <ChevronLeftIcon />
            </Link>
            <div>
              <h1 className="text-lg font-semibold">Manage your Profile &amp; Account</h1>
              <p className="text-sm text-white/60">@—</p>
            </div>
          </div>
        </header>
        <div className="p-6 text-white/80">Bitte melde dich an, um Einstellungen zu ändern.</div>
      </section>
    );
  }

  const { hasPhone, hasCountry, hasIsDeactivated } = await getUserColumnFlags();

  // Basisfelder, die sicher existieren
  const base = await prisma.user.findUnique({
    where: { id: me.id },
    select: { id: true, handle: true, email: true },
  });

  // Optionale Felder nur per Raw lesen, wenn vorhanden
  let phone: string | null = null;
  let country: string | null = null;
  let isDeactivated = false;

  if (hasPhone) {
    const r = await prisma.$queryRaw<{ phone: string | null }[]>`
      SELECT "phone" FROM "User" WHERE id = ${me.id} LIMIT 1
    `;
    phone = r[0]?.phone ?? null;
  }
  if (hasCountry) {
    const r = await prisma.$queryRaw<{ country: string | null }[]>`
      SELECT "country" FROM "User" WHERE id = ${me.id} LIMIT 1
    `;
    country = r[0]?.country ?? null;
  }
  if (hasIsDeactivated) {
    const r = await prisma.$queryRaw<{ isDeactivated: boolean }[]>`
      SELECT "isDeactivated" FROM "User" WHERE id = ${me.id} LIMIT 1
    `;
    isDeactivated = r[0]?.isDeactivated ?? false;
  }

  const user = {
    id: base?.id ?? '',
    handle: base?.handle ?? '',
    email: base?.email ?? null,
    phone,
    country,
    isDeactivated,
  };

  return (
    <section className="rounded-xl border border-white/10 overflow-hidden">
      <header className="px-4 pt-3 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Link href={`/${locale}/settings`} className="p-1" aria-label="Zurück">
            <ChevronLeftIcon />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">Manage your Profile &amp; Account</h1>
            <p className="text-sm text-white/60">@{user.handle}</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4">
        {/* Profile */}
        <section className="rounded-lg border border-white/10 p-4">
          <h2 className="text-base font-semibold mb-4">Profil</h2>
          <form action={updateProfileAction} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Handle</label>
              <input
                name="handle"
                defaultValue={user.handle ?? ''}
                placeholder="dein.handle"
                className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-white/20"
              />
              <p className="text-xs text-white/50 mt-1">
                3–20 Zeichen; a–z, 0–9, „_“ und „.“ erlaubt.
              </p>
            </div>

            <div>
              <label className="block text-sm mb-1">E-Mail</label>
              <input
                type="email"
                name="email"
                defaultValue={user.email ?? ''}
                placeholder="du@example.com"
                className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Telefonnummer</label>
              <input
                type="tel"
                name="phone"
                defaultValue={user.phone ?? ''}
                placeholder={hasPhone ? '+49 170 1234567' : 'Spalte fehlt in DB'}
                disabled={!hasPhone}
                className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Land</label>
              <input
                name="country"
                defaultValue={user.country ?? ''}
                placeholder={hasCountry ? 'DE, AT, CH, US' : 'Spalte fehlt in DB'}
                disabled={!hasCountry}
                className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/15"
              >
                Profil speichern
              </button>
            </div>
          </form>
        </section>

        {/* Password */}
        <section className="rounded-lg border border-white/10 p-4">
          <h2 className="text-base font-semibold mb-4">Passwort</h2>
          <form action={changePasswordAction} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">Aktuelles Passwort</label>
              <input
                type="password"
                name="currentPassword"
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Neues Passwort</label>
              <input
                type="password"
                name="newPassword"
                placeholder="mind. 8 Zeichen"
                autoComplete="new-password"
                className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Neues Passwort (Wiederholen)</label>
              <input
                type="password"
                name="newPassword2"
                placeholder="nochmal eingeben"
                autoComplete="new-password"
                className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/15"
              >
                Passwort ändern
              </button>
            </div>
          </form>
        </section>

        {/* Logout */}
        <section className="rounded-lg border border-white/10 p-4">
          <h2 className="text-base font-semibold mb-4">Abmelden</h2>
          <form action={logoutAction}>
            <button
              type="submit"
              className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/15"
              title="Abmelden"
            >
              Abmelden
            </button>
          </form>
        </section>

        {/* Danger Zone */}
        <section className="rounded-lg border border-red-400/30 p-4 bg-red-500/5">
          <h2 className="text-base font-semibold mb-3 text-red-300">Gefahrenbereich</h2>
          <p className="text-sm text-white/70 mb-4">
            Das Deaktivieren sperrt dein Profil und beendet deine Sitzungen.
          </p>
          <form action={deactivateAccountAction}>
            <button
              type="submit"
              className="px-4 py-2 rounded-full bg-red-500/90 hover:bg-red-500 text-white"
              disabled={!hasIsDeactivated || !!user.isDeactivated}
              title={
                !hasIsDeactivated
                  ? 'Spalte isDeactivated fehlt in DB'
                  : user.isDeactivated
                  ? 'Bereits deaktiviert'
                  : 'Account deaktivieren'
              }
            >
              {!hasIsDeactivated
                ? 'Deaktivieren nicht verfügbar'
                : user.isDeactivated
                ? 'Account ist deaktiviert'
                : 'Account deaktivieren'}
            </button>
          </form>
        </section>
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
    >
      <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
