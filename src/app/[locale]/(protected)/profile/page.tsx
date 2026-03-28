// src/app/[locale]/profile/page.tsx
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';

import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';
import { getCurrentUser } from '@/lib/currentUser';
import type { User } from '@prisma/client';

// ⬇️ i18n: auf createTranslator + manuelles Laden umgestellt
import { createTranslator } from 'next-intl';
import { notFound } from 'next/navigation';

import BackButton from '@/components/BackButtonStandard';
import SaveProfileButton from '@/components/SaveProfileButton';


// ⬇️ Neu hinzugefügt (für Deaktivieren/ Löschen / Cookies):
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ACTIVE_COOKIE_NAME, buildActiveUserCookieValue } from '@/lib/activeUserCookie';

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

async function updateProfileAction(formData: FormData) {
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

  const handleClash = await prisma.user.findFirst({
    where: { handle: handleRaw, NOT: { id: user.id } },
    select: { id: true },
  });
  if (handleClash) throw new Error('Handle ist bereits vergeben.');

  // Aktuelle E-Mail lesen um Änderung zu erkennen
  const currentUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true },
  });
  const emailChanged = email !== null && email !== currentUser?.email;

  if (email) {
    const emailClash = await prisma.user.findFirst({
      where: { email, NOT: { id: user.id } },
      select: { id: true },
    });
    if (emailClash) throw new Error('E-Mail ist bereits vergeben.');
  }

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

  // Bei E-Mail-Änderung: aktuelle Session-Token aus Cookie lesen,
  // dann alle ANDEREN Sessions löschen (aktuelle behalten)
  if (emailChanged) {
    const jar = await cookies();
    const currentToken =
      jar.get('next-auth.session-token')?.value ||
      jar.get('__Secure-next-auth.session-token')?.value ||
      jar.get('sessionToken')?.value ||
      null;

    if (currentToken) {
      await prisma.session.deleteMany({
        where: {
          userId: user.id,
          sessionToken: { not: currentToken },
        },
      });
    } else {
      // Fallback: alle Sessions löschen wenn wir den Token nicht kennen
      await prisma.session.deleteMany({ where: { userId: user.id } });
    }
  }

  revalidatePath('/[locale]/profile', 'page');
}

async function changePasswordAction(formData: FormData) {
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

/**
 * Deaktivieren mit Auto-Switch:
 * - Wenn deaktivierter Account ein verknüpfter Alt ist → zurück auf Owner (active_user_id löschen) & HomeFeed
 * - Wenn deaktivierter Account der Owner ist:
 *   - Falls es verknüpfte Accounts gibt → active_user_id auf den ersten Link setzen & HomeFeed
 *   - Sonst komplette Abmeldung → /signin
 * - Deaktivierter Account wird entkoppelt
 */
async function deactivateAccountAction() {
  'use server';

  // Owner der Session ermitteln
  const session = await getServerSession(authOptions).catch(() => null);
  const ownerId = session?.user?.id ?? null;

  // Aktuell "aktiven" User ermitteln (Owner ODER verknüpfter)
  const { user } = await requireUser();
  const { hasIsDeactivated } = await getUserColumnFlags();

  if (!hasIsDeactivated) {
    throw new Error(
      'Deaktivieren nicht möglich: Spalte "isDeactivated" fehlt in der DB. Bitte Migration ausführen.'
    );
  }

  // 1) User deaktivieren
  await prisma.user.update({
    where: { id: user.id },
    data: { isDeactivated: true },
  });

  // 2) Entkoppeln, falls verknüpft
  if (ownerId) {
    await prisma.accountLink.deleteMany({
      where: { ownerId, linkedUserId: user.id },
    });
  }

  const jar = await cookies();

  async function setActiveUserCookie(nextUserId: string | null) {
    if (!nextUserId) {
      jar.delete(ACTIVE_COOKIE_NAME);
      return;
    }
    const value = await buildActiveUserCookieValue(nextUserId);
    if (value) {
      jar.set(ACTIVE_COOKIE_NAME, value, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7,
      });
    }
  }

  // A) Deaktivierter Account ist ein verknüpfter Alt (NICHT Owner der Session)
  if (ownerId && user.id !== ownerId) {
    await setActiveUserCookie(null);
    await prisma.session.deleteMany({ where: { userId: user.id } }).catch(() => {});
    redirect('/'); // HomeFeed
  }

  // B) Deaktivierter Account IST der Owner der Session
  if (ownerId && user.id === ownerId) {
    const links = await prisma.accountLink.findMany({
      where: { ownerId },
      select: { linkedUserId: true },
      orderBy: { createdAt: 'asc' },
      take: 1,
    });

    const fallbackLinked = links[0]?.linkedUserId ?? null;

    if (fallbackLinked) {
      await setActiveUserCookie(fallbackLinked);
      redirect('/'); // HomeFeed
    }

    await prisma.session.deleteMany({ where: { userId: user.id } }).catch(() => {});
    const expire = { expires: new Date(0), httpOnly: true, path: '/' as const };
    const jarExpire = cookies();
    (await jarExpire).set('sessionToken', '', expire);
    (await jarExpire).set('next-auth.session-token', '', expire);
    (await jarExpire).set('__Secure-next-auth.session-token', '', expire);
    (await jarExpire).delete(ACTIVE_COOKIE_NAME);

    redirect('/signin');
  }

  // C) Kein Owner in der Session → abmelden
  await prisma.session.deleteMany({ where: { userId: user.id } }).catch(() => {});
  const expire = { expires: new Date(0), httpOnly: true, path: '/' as const };
  const jar2 = await cookies();
  jar2.set('sessionToken', '', expire);
  jar2.set('next-auth.session-token', '', expire);
  jar2.set('__Secure-next-auth.session-token', '', expire);
  jar2.delete(ACTIVE_COOKIE_NAME);
  redirect('/signin');
}

/**
 * Vollständiges Löschen des aktuell aktiven Accounts.
 */
async function deleteAccountAction() {
  'use server';

  const session = await getServerSession(authOptions).catch(() => null);
  const ownerId = session?.user?.id ?? null;

  const { user } = await requireUser();

  const jar = await cookies();

  async function clearSessionAndCookies() {
    await prisma.session.deleteMany({ where: { userId: user.id } }).catch(() => {});
    const expire = { expires: new Date(0), httpOnly: true, path: '/' as const };
    jar.set('sessionToken', '', expire);
    jar.set('next-auth.session-token', '', expire);
    jar.set('__Secure-next-auth.session-token', '', expire);
    jar.delete(ACTIVE_COOKIE_NAME);
  }

  async function setActiveUserCookie(nextUserId: string | null) {
    if (!nextUserId) {
      jar.delete(ACTIVE_COOKIE_NAME);
      return;
    }
    const value = await buildActiveUserCookieValue(nextUserId);
    if (value) {
      jar.set(ACTIVE_COOKIE_NAME, value, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7,
      });
    }
  }

  await prisma.$transaction([
    prisma.accountLink.deleteMany({ where: { ownerId: user.id } }),
    prisma.accountLink.deleteMany({ where: { linkedUserId: user.id } }),
  ]);

  await prisma.session.deleteMany({ where: { userId: user.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: user.id } }).catch((e) => {
    throw e;
  });

  if (ownerId && user.id !== ownerId) {
    await setActiveUserCookie(null);
    redirect('/');
  }

  if (ownerId && user.id === ownerId) {
    await clearSessionAndCookies();
    redirect('/signin');
  }

  await clearSessionAndCookies();
  redirect('/signin');
}

async function logoutAction() {
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
   Language change (Server Action)
========================= */

async function changeLanguageAction(formData: FormData) {
  'use server';
  const requested = (formData.get('language') ?? '').toString();
  const allowed = new Set(['en', 'de', 'es', 'fr']);
  const next = allowed.has(requested) ? requested : 'en';
  redirect(`/${next}/profile`);
}

/* =========================
   Page Component (Server)
========================= */

export default async function SettingsPage({ params }: { params: Promise<Params> }) {
  // Akzeptiert sowohl {locale} als Plain-Objekt als auch Promise<Params>
  const { locale } = await params;

  // ⬅️ Übersetzungen manuell laden & Translator für Namespace "settings.profileSettings" bauen
  let t: ReturnType<typeof createTranslator>;
  try {
    const settingsFile = (await import(`@/messages/${locale}/settings.json`)).default;
    t = createTranslator({
      locale,
      messages: { settings: settingsFile },
      namespace: 'settings.profileSettings'
    });
  } catch {
    notFound();
  }

  const me = await getCurrentUser().catch(() => null);
  if (!me) {
    return (
      <section className="rounded-xl border border-white/10 overflow-hidden">
        <header className="px-4 pt-3 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Link href={`/${locale}/settings`} className="p-1" aria-label={t('ariaBack')}>
              <ChevronLeftIcon />
            </Link>
            <div>
              <h1 className="text-lg font-semibold">{t('headerTitle')}</h1>
              <p className="text-sm text-white/60">@—</p>
            </div>
          </div>
        </header>
        <div className="p-6 text-white/80">{t('notSignedInMessage')}</div>
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
          <BackButton
            fallbackHref={`/${locale}`}
            ariaLabel={t('ariaBack')}
            className="inline-flex items-center justify-center p-1 hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
            style={{ color: 'var(--purple)' }}
          >
            <ChevronLeftIcon />
          </BackButton>
          <div className="ml-2 sm:ml-3">
            <h1 className="text-lg font-semibold">{t('headerTitle')}</h1>
            <p className="text-sm text-white/60">@{user.handle}</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4">
        {/* Profile */}
        <section className="rounded-lg border border-white/10 p-4">
          <h2 className="text-base font-semibold mb-4">{t('profileSectionTitle')}</h2>

          {/* Language picker */}
          <form action={changeLanguageAction} className="space-y-2 mb-6">
            <label className="block text-sm mb-1">{t('languageLabel')}</label>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <select
                  name="language"
                  defaultValue={locale}
                  aria-label={t('languageLabel')}
                  className="peer w-full appearance-none pr-10 pl-3 py-2 rounded-md
                            bg-[#1a1b1f] text-white placeholder-white/60
                            border border-white/20
                            outline-none focus:ring-2 focus:ring-[var(--purple)]/40 focus:border-[var(--purple)]/50
                            transition"
                  style={{
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    colorScheme: 'dark'
                  }}
                >
                  <option value="en">English</option>
                  <option value="de">Deutsch</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                </select>

                {/* Chevron */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2
                            inline-grid place-items-center text-white/70 peer-focus:text-white"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </div>

              <button
                type="submit"
                className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/15"
                title={t('languageButton')}
              >
                {t('languageButton')}
              </button>
            </div>

            <p className="text-xs text-white/50 mt-1">{t('languageHelp')}</p>
          </form>

          {/* Profil-Formular */}
          <form action={updateProfileAction} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">{t('handleLabel')}</label>
              <input
                name="handle"
                defaultValue={user.handle ?? ''}
                placeholder={t('handlePlaceholder')}
                className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-white/20"
              />
              <p className="text-xs text-white/50 mt-1">{t('handleHelp')}</p>
            </div>

            <div>
              <label className="block text-sm mb-1">{t('emailLabel')}</label>
              <input
                type="email"
                name="email"
                defaultValue={user.email ?? ''}
                placeholder={t('emailPlaceholder')}
                className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">{t('phoneLabel')}</label>
              <input
                type="tel"
                name="phone"
                defaultValue={user.phone ?? ''}
                placeholder={hasPhone ? t('phonePlaceholder') : t('phoneMissing')}
                disabled={!hasPhone}
                className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">{t('countryLabel')}</label>
              <input
                name="country"
                defaultValue={user.country ?? ''}
                placeholder={hasCountry ? t('countryPlaceholder') : t('countryMissing')}
                disabled={!hasCountry}
                className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>

            <div className="pt-2">
              <SaveProfileButton
                label={t('saveProfile')}
                toastMessage={t('profileSavedToast')}
              />
            </div>
          </form>
        </section>

        {/* Password */}
        <section className="rounded-lg border border-white/10 p-4">
          <h2 className="text-base font-semibold mb-4">{t('passwordSectionTitle')}</h2>
          <form action={changePasswordAction} className="space-y-4">
            <div>
              <label className="block text-sm mb-1">{t('currentPasswordLabel')}</label>
              <input
                type="password"
                name="currentPassword"
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">{t('newPasswordLabel')}</label>
              <input
                type="password"
                name="newPassword"
                placeholder={t('newPasswordPlaceholder')}
                autoComplete="new-password"
                className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">{t('newPassword2Label')}</label>
              <input
                type="password"
                name="newPassword2"
                placeholder={t('newPassword2Placeholder')}
                autoComplete="new-password"
                className="w-full rounded-md bg-white/5 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/15"
              >
                {t('changePassword')}
              </button>
            </div>
          </form>
        </section>

        {/* Logout */}
        <section className="rounded-lg border border-white/10 p-4">
          <h2 className="text-base font-semibold mb-4">{t('logoutSectionTitle')}</h2>
          <form action={logoutAction}>
            <button
              type="submit"
              className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/15"
              title={t('logoutButton')}
            >
              {t('logoutButton')}
            </button>
          </form>
        </section>

        {/* Danger Zone */}
        <section className="rounded-lg border border-red-400/30 p-4 bg-red-500/5">
          <h2 className="text-base font-semibold mb-3 text-red-300">{t('dangerZoneTitle')}</h2>
          <p className="text-sm text-white/70 mb-4">{t('dangerZoneDesc')}</p>

          <div className="flex flex-col sm:flex-row gap-3">
            {/* Deactivate */}
            <form action={deactivateAccountAction}>
              <button
                type="submit"
                className="px-4 py-2 rounded-full bg-red-500/90 hover:bg-red-500 text-white"
                disabled={!hasIsDeactivated || !!user.isDeactivated}
                title={
                  !hasIsDeactivated
                    ? t('deactivateNotAvailable')
                    : user.isDeactivated
                    ? t('alreadyDeactivated')
                    : t('deactivateButton')
                }
              >
                {!hasIsDeactivated
                  ? t('deactivateNotAvailable')
                  : user.isDeactivated
                  ? t('alreadyDeactivated')
                  : t('deactivateButton')}
              </button>
            </form>

            {/* Delete permanently */}
            <form action={deleteAccountAction}>
              <button
                type="submit"
                className="px-4 py-2 rounded-full bg-red-700/90 hover:bg-red-700 text-white border border-red-300/30"
                title={t('deleteButtonTitle')}
              >
                {t('deleteButton')}
              </button>
            </form>
          </div>

          <p className="text-xs text-white/60 mt-2">
            {t('deleteHint')}
          </p>
        </section>
      </div>
    </section>
  );
}

/* ===== Icons ===== */
function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
