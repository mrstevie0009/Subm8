import Link from 'next/link';
import Image from 'next/image';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import QRCode from 'qrcode';
import { authenticator } from 'otplib';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

type Params = { locale: string };

export const dynamic = 'force-dynamic';

/* =========================
   Helpers
========================= */

async function getAuthUser() {
  const me = await getCurrentUser().catch(() => null);
  if (!me) return null;

  const user = await prisma.user.findUnique({
    where: { id: me.id },
    select: {
      id: true,
      handle: true,
      email: true,
      phone: true,
      twoFactorEnabled: true,
      twoFactorType: true,
      twoFactorSecret: true,
      twoFactorTempSecret: true,
      passwordResetProtection: true,
      isDeactivated: true,
    },
  });

  return user;
}

async function requireUser() {
  const user = await getAuthUser();
  if (!user) throw new Error('Not authenticated');
  if (user.isDeactivated) throw new Error('Account is deactivated');
  return { user };
}

/* =========================
   Server Actions (TOTP)
========================= */

export async function startTotpSetupAction() {
  'use server';
  const { user } = await requireUser();

  if (user.twoFactorEnabled && user.twoFactorType === 'TOTP') return;

  const secret = authenticator.generateSecret();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      twoFactorTempSecret: secret,
      twoFactorType: 'TOTP',
    },
  });

  revalidatePath('/[locale]/security', 'page');
}

export async function verifyTotpAction(formData: FormData) {
  'use server';
  const { user } = await requireUser();
  const token = (formData.get('token') ?? '').toString().trim();

  if (!user.twoFactorTempSecret) {
    throw new Error('Kein TOTP-Setup aktiv.');
  }

  const ok = authenticator.check(token, user.twoFactorTempSecret);
  if (!ok) throw new Error('Code ungültig. Bitte erneut versuchen.');

  await prisma.user.update({
    where: { id: user.id },
    data: {
      twoFactorEnabled: true,
      twoFactorSecret: user.twoFactorTempSecret,
      twoFactorTempSecret: null,
      twoFactorType: 'TOTP',
    },
  });

  revalidatePath('/[locale]/security', 'page');
}

export async function disable2FAAction() {
  'use server';
  const { user } = await requireUser();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorTempSecret: null,
      twoFactorType: null,
    },
  });

  revalidatePath('/[locale]/security', 'page');
}

/* =========================
   Server Actions (Settings)
========================= */

export async function togglePasswordResetProtectionAction() {
  'use server';
  const { user } = await requireUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetProtection: !user.passwordResetProtection },
  });
  revalidatePath('/[locale]/security', 'page');
}

export async function logoutAllSessionsAction() {
  'use server';
  const { user } = await requireUser();

  await prisma.session.deleteMany({ where: { userId: user.id } }).catch(() => {});

  const jar = await cookies();
  const expire = { expires: new Date(0), httpOnly: true, path: '/' as const };
  jar.set('sessionToken', '', expire);
  jar.set('next-auth.session-token', '', expire);
  jar.set('__Secure-next-auth.session-token', '', expire);

  redirect('/signin');
}

/* =========================
   Page
========================= */

export default async function SecurityPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
  const user = await getAuthUser();

  if (!user) {
    return (
      <section className="rounded-xl border border-white/10 overflow-hidden">
        <header className="px-4 pt-3 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Link href={`/${locale}/settings`} className="p-1" aria-label="Zurück">
              <ChevronLeftIcon />
            </Link>
            <div>
              <h1 className="text-lg font-semibold">Sicherheit &amp; Zugriff</h1>
              <p className="text-sm text-white/60">@—</p>
            </div>
          </div>
        </header>
        <div className="p-6 text-white/80">Bitte melde dich an, um Sicherheitsoptionen zu verwalten.</div>
      </section>
    );
  }

  // QR-Code nur während des Setups rendern
  let qrDataUrl: string | null = null;
  if (user.twoFactorTempSecret && user.email) {
    const issuer = encodeURIComponent(process.env.NEXT_PUBLIC_APP_NAME ?? 'Subm8');
    const otpauth = authenticator.keyuri(user.email, issuer, user.twoFactorTempSecret);
    qrDataUrl = await QRCode.toDataURL(otpauth);
  }

  return (
    <section className="rounded-xl border border-white/10 overflow-hidden">
      <header className="px-4 pt-3 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Link href={`/${locale}/settings`} className="p-1" aria-label="Zurück">
            <ChevronLeftIcon />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">Sicherheit &amp; Zugriff</h1>
            <p className="text-sm text-white/60">@{user.handle}</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4">
        {/* Zwei-Faktor-Authentifizierung */}
        <section className="rounded-lg border border-white/10 p-4">
          <h2 className="text-base font-semibold mb-2">Zwei-Faktor-Authentifizierung</h2>
          <p className="text-sm text-white/70 mb-4">
            Schütze deinen Account mit einer zweiten Anmeldestufe. Du kannst eine App (TOTP), SMS
            (wenn Telefonnummer hinterlegt) oder später Sicherheitsschlüssel/Passkeys verwenden.
          </p>

          {/* TOTP (App) */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">Authenticator-App (TOTP)</h3>
              {user.twoFactorEnabled && user.twoFactorType === 'TOTP' ? (
                <form action={disable2FAAction}>
                  <button className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-sm">
                    Deaktivieren
                  </button>
                </form>
              ) : user.twoFactorTempSecret ? null : (
                <form action={startTotpSetupAction}>
                  <button className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-sm">
                    Einrichten
                  </button>
                </form>
              )}
            </div>

            {user.twoFactorEnabled && user.twoFactorType === 'TOTP' && (
              <p className="text-sm text-emerald-300">Aktiv: App-basierte 2FA ist eingeschaltet.</p>
            )}

            {/* Setup-Step: QR + Code-Eingabe */}
            {user.twoFactorTempSecret && qrDataUrl && (
              <div className="mt-3 rounded-md border border-white/10 p-3">
                <p className="text-sm mb-2">
                  Scanne den QR-Code mit deiner Authenticator-App und gib anschließend den 6-stelligen
                  Code ein.
                </p>
                <div className="w-40 h-40 relative mb-3">
                  <Image
                    src={qrDataUrl}
                    alt="TOTP QR Code"
                    width={160}
                    height={160}
                    className="rounded bg-white p-1"
                    unoptimized
                    priority
                  />
                </div>
                <form action={verifyTotpAction} className="flex items-center gap-2">
                  <input
                    name="token"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="123456"
                    className="w-32 rounded-md bg-white/5 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-white/20"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-sm"
                  >
                    Bestätigen
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* SMS (deaktiviert) */}
          <div className="mb-6 opacity-60 pointer-events-none">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-medium">SMS-Codes</h3>
              <span className="text-xs px-2 py-1 rounded-full bg-white/10 border border-white/15">
                Bald
              </span>
            </div>
            <p className="text-sm text-white/70">
              Verfügbar, wenn eine Telefonnummer hinterlegt ist und SMS-Versand konfiguriert wurde.
            </p>
          </div>

          {/* Sicherheitsschlüssel / Passkeys (deaktiviert) */}
          <div className="opacity-60 pointer-events-none">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-medium">Sicherheitsschlüssel / Passkeys</h3>
              <span className="text-xs px-2 py-1 rounded-full bg-white/10 border border-white/15">
                Bald
              </span>
            </div>
            <p className="text-sm text-white/70">
              Unterstützung für WebAuthn/Passkeys folgt.
            </p>
          </div>
        </section>

        {/* Zusätzlicher Passwortschutz */}
        <section className="rounded-lg border border-white/10 p-4">
          <h2 className="text-base font-semibold mb-2">Zusätzlicher Passwortschutz</h2>
          <p className="text-sm text-white/70 mb-4">
            Beim Zurücksetzen des Passworts muss zusätzlich E-Mail oder Telefonnummer bestätigt werden.
          </p>

          <form action={togglePasswordResetProtectionAction}>
            <button
              type="submit"
              className="px-4 py-2 rounded-full border border-white/15 bg-white/10 hover:bg-white/15"
              title="Passwort-Zurücksetzungsschutz umschalten"
            >
              {user.passwordResetProtection ? 'Schutz deaktivieren' : 'Schutz aktivieren'}
            </button>
          </form>

          <div className="mt-6">
            <h3 className="font-medium mb-2">Sitzungen beenden</h3>
            <p className="text-sm text-white/70 mb-3">
              Beendet alle aktiven Sitzungen auf allen Geräten und meldet dich hier ab.
            </p>
            <form action={logoutAllSessionsAction}>
              <button
                type="submit"
                className="px-4 py-2 rounded-full border border-white/15 bg-white/10 hover:bg-white/15"
              >
                Alle Sitzungen beenden
              </button>
            </form>
          </div>
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
