// src/app/[locale]/security/page.tsx
import Link from 'next/link';
import Image from 'next/image';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { authenticator } from 'otplib';

import { createTranslator } from 'next-intl';
import { notFound } from 'next/navigation';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import BackButton from '@/components/BackButtonStandard';
import PasskeySetupClient from '@/components/security/PasskeySetupClient';
import { sendSms } from '@/lib/sms';
import React from 'react';

type Params = { locale: string };

export const dynamic = 'force-dynamic';

/* =========================
   Helpers
========================= */

function maskPhone(p: string) {
  const m = p.match(/^(\+\d{1,3})(.*?)(\d{2})$/);
  if (!m) return p;
  const cc = m[1];
  const middle = m[2].replace(/\d/g, '*').replace(/\*{3,}/g, (s) => s);
  const last2 = m[3];
  return `${cc}${middle}${last2}`;
}

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
  if (!user) return null;

  const passkeyCount = await prisma.webAuthnCredential.count({
    where: { userId: me.id },
  });

  const now = new Date();
  const pendingSmsCount = await prisma.smsCode.count({
    where: { userId: me.id, purpose: '2FA_SETUP', expiresAt: { gt: now } },
  });

  return { ...user, passkeyCount, smsPending: pendingSmsCount > 0 };
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

async function startTotpSetupAction() {
  'use server';
  const { user } = await requireUser();

  if (user.twoFactorEnabled && user.twoFactorType === 'TOTP') return;

  const secret = authenticator.generateSecret();

  await prisma.user.update({
    where: { id: user.id },
    data: { twoFactorTempSecret: secret },
  });

  revalidatePath('/[locale]/security', 'page');
}

async function verifyTotpAction(formData: FormData) {
  'use server';
  const { user } = await requireUser();
  const token = (formData.get('token') ?? '').toString().trim();

  if (!user.twoFactorTempSecret) throw new Error('no_totp_setup');
  if (!token || !/^\d{6}$/.test(token)) throw new Error('invalid_code');

  const ok = authenticator.check(token, user.twoFactorTempSecret);
  if (!ok) throw new Error('invalid_code');

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

async function disable2FAAction() {
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
   Server Actions (Passkeys)
========================= */

async function disablePasskeysAction() {
  'use server';
  const { user } = await requireUser();

  await prisma.webAuthnCredential.deleteMany({ where: { userId: user.id } });

  if (user.twoFactorEnabled && user.twoFactorType === 'WEBAUTHN') {
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorType: null },
    });
  }

  revalidatePath('/[locale]/security', 'page');
}

/* =========================
   Server Actions (SMS)
========================= */

async function startSmsSetupAction() {
  'use server';
  const { user } = await requireUser();

  if (!user.phone) throw new Error('no_phone');

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.smsCode.deleteMany({ where: { userId: user.id, purpose: '2FA_SETUP' } });

  await prisma.smsCode.create({
    data: { userId: user.id, code, purpose: '2FA_SETUP', expiresAt },
  });

  await sendSms({ to: user.phone, body: `Dein Subm8-Code: ${code} (10 Minuten gültig)` });

  revalidatePath('/[locale]/security', 'page');
}

async function verifySmsSetupAction(formData: FormData) {
  'use server';
  const { user } = await requireUser();
  const code = (formData.get('code') ?? '').toString().trim();

  if (!/^\d{6}$/.test(code)) throw new Error('invalid_code');

  const entry = await prisma.smsCode.findFirst({
    where: { userId: user.id, purpose: '2FA_SETUP' },
    orderBy: { expiresAt: 'desc' },
  });

  if (!entry || entry.expiresAt < new Date()) throw new Error('expired');

  if (entry.code !== code) {
    await prisma.smsCode.update({ where: { id: entry.id }, data: { attempts: { increment: 1 } } });
    throw new Error('wrong_code');
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true, twoFactorType: 'SMS' },
    }),
    prisma.smsCode.deleteMany({ where: { userId: user.id, purpose: '2FA_SETUP' } }),
  ]);

  revalidatePath('/[locale]/security', 'page');
}

async function disableSms2FAAction() {
  'use server';
  const { user } = await requireUser();

  if (user.twoFactorEnabled && user.twoFactorType === 'SMS') {
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorType: null },
    });
  }

  await prisma.smsCode.deleteMany({ where: { userId: user.id } }).catch(() => {});
  await prisma.smsChallenge?.deleteMany?.({ where: { userId: user.id } }).catch(() => {});

  revalidatePath('/[locale]/security', 'page');
}

async function disableSmsNumberAction() {
  'use server';
  const { user } = await requireUser();

  if (user.phone) {
    await prisma.user.update({
      where: { id: user.id },
      data: { phone: null },
    });
  }

  if (user.twoFactorEnabled && user.twoFactorType === 'SMS') {
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorType: null },
    });
  }

  await prisma.smsCode.deleteMany({ where: { userId: user.id } }).catch(() => {});
  await prisma.smsChallenge?.deleteMany?.({ where: { userId: user.id } }).catch(() => {});

  revalidatePath('/[locale]/security', 'page');
}

/* =========================
   Server Actions (Settings)
========================= */

async function togglePasswordResetProtectionAction() {
  'use server';
  const { user } = await requireUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetProtection: !user.passwordResetProtection },
  });
  revalidatePath('/[locale]/security', 'page');
}

async function logoutAllSessionsAction() {
  'use server';
  const { user } = await requireUser();

  await prisma.session.deleteMany({ where: { userId: user.id } }).catch(() => {});
  redirect('/signin');
}

/* =========================
   Page
========================= */

export default async function SecurityPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;

  // i18n
  let t: ReturnType<typeof createTranslator>;
  let tRoot: ReturnType<typeof createTranslator>;
  try {
    const settingsFile = (await import(`@/messages/${locale}/settings.json`)).default;
    t = createTranslator({ locale, messages: { settings: settingsFile }, namespace: 'settings.securityPage' });
    tRoot = createTranslator({ locale, messages: { settings: settingsFile }, namespace: 'settings' });
  } catch {
    notFound();
  }

  const user = await getAuthUser();

  if (!user) {
    return (
      <Viewport>
        <section className="mx-auto max-w-3xl rounded-xl border border-white/10 overflow-hidden">
          <header className="px-4 pt-3 pb-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Link href={`/${locale}/settings`} className="p-1" aria-label={t('ariaBack')}>
                <ChevronLeftIcon />
              </Link>
              <div>
                <h1 className="text-lg font-semibold">{t('title')}</h1>
                <p className="text-sm text-white/60">@—</p>
              </div>
            </div>
          </header>
          <div className="p-6 text-white/80">{t('notSignedInMessage')}</div>
        </section>
      </Viewport>
    );
  }

  // QR
  let qrDataUrl: string | null = null;
  if (user.twoFactorTempSecret && user.email) {
    const issuer = encodeURIComponent(process.env.NEXT_PUBLIC_APP_NAME ?? 'Subm8');
    const label = encodeURIComponent(user.email);
    const otpauth = `otpauth://totp/${issuer}:${label}?secret=${user.twoFactorTempSecret}&issuer=${issuer}`;
    qrDataUrl = await QRCode.toDataURL(otpauth);
  }

  const passkeyActive =
    (user.twoFactorEnabled && user.twoFactorType === 'WEBAUTHN') || user.passkeyCount > 0;
  const totpActive = user.twoFactorEnabled && user.twoFactorType === 'TOTP';
  const smsActive = user.twoFactorEnabled && user.twoFactorType === 'SMS';
  const phoneReady = Boolean(user.phone);

  return (
    <Viewport>
      <section className="mx-auto max-w-5xl rounded-xl border border-white/10 overflow-hidden">
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
              <h1 className="text-lg font-semibold">{t('title')}</h1>
              <p className="text-sm text-white/60">@{user.handle}</p>
            </div>
          </div>
        </header>

        {/* Banner */}
        <div className="p-4 space-y-3">
          {passkeyActive && (
            <SuccessCallout>
              <span className="font-medium">✅ {t('twofa.passkeysTitle')}</span> {t('twofa.passkeyActiveMsg')}
            </SuccessCallout>
          )}
          {totpActive && (
            <SuccessCallout>
              <span className="font-medium">✅ {t('twofa.totpTitle')}</span> {t('twofa.active')}
            </SuccessCallout>
          )}
          {smsActive && (
            <SuccessCallout>
              <span className="font-medium">✅ {t('twofa.smsTitle')}</span> {t('twofa.smsActiveMsg')}
            </SuccessCallout>
          )}
          {!smsActive && phoneReady && (
            <InfoCallout>
              <span className="font-medium">ℹ️ {t('twofa.smsTitle')}</span> {t('twofa.smsPhoneReady')}
            </InfoCallout>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4 pt-0">
          {/* 2FA */}
          <section className="rounded-lg border border-white/10 p-4">
            <h2 className="text-base font-semibold mb-2">{t('twofa.title')}</h2>
            <p className="text-sm text-white/70 mb-4">{t('twofa.intro')}</p>

            {/* Passkeys */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-medium">{t('twofa.passkeysTitle')}</h3>
                <span
                  className={`text-xs px-2 py-1 rounded-full border ${
                    passkeyActive
                      ? 'bg-emerald-400/15 border-emerald-400/30 text-emerald-200'
                      : 'bg-white/10 border-white/15 text-white/80'
                  }`}
                >
                  {passkeyActive ? t('status.active') : t('status.notSetup')}
                </span>
              </div>

              <p className="text-sm text-white/70 mb-3">
                {passkeyActive ? t('twofa.passkeysActiveNote') : t('twofa.passkeysNote')}
              </p>

              <div className="flex items-center gap-2">
                <PasskeySetupClient key={String(passkeyActive)} mode={passkeyActive ? 'add' : 'setup'} />
                {passkeyActive && (
                  <form action={disablePasskeysAction}>
                    <button
                      type="submit"
                      className="inline-flex items-center px-3 py-1.5 rounded-full border border-white/15 bg-white/10 hover:bg-white/15 text-sm"
                      title={t('twofa.passkeysRemoveAllTitle')}
                    >
                      {t('twofa.passkeysDisable')}
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* SMS */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-medium">{t('twofa.smsTitle')}</h3>
                <span
                  className={`text-xs px-2 py-1 rounded-full border ${
                    smsActive
                      ? 'bg-emerald-400/15 border-emerald-400/30 text-emerald-200'
                      : phoneReady
                        ? 'bg-white/10 border-white/15 text-white/80'
                        : 'bg-white/10 border-white/15 text-white/50'
                  }`}
                >
                  {smsActive ? t('status.active') : phoneReady ? t('status.ready') : t('status.notSetup')}
                </span>
              </div>

              <div className="mb-3 flex items-center gap-2 text-sm text-white/70">
                {phoneReady ? (
                  <>
                    <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5">
                      {maskPhone(user.phone!)}
                    </span>
                    <Link
                      href={`/${locale}/settings`}
                      className="underline decoration-white/30 hover:decoration-white"
                      title={t('twofa.smsChangeNumber')}
                    >
                      {t('twofa.smsChangeNumber')}
                    </Link>
                  </>
                ) : (
                  <span>{t('twofa.smsAddPhoneFirst')}</span>
                )}
              </div>

              {!smsActive && phoneReady && (
                <div className="flex items-center gap-2 flex-wrap">
                  {!user.smsPending ? (
                    <form action={startSmsSetupAction}>
                      <button
                        type="submit"
                        className="h-10 px-3 rounded-full border border-white/15 bg-white/10 hover:bg-white/15 text-sm"
                      >
                        {t('twofa.sms.request')}
                      </button>
                    </form>
                  ) : (
                    <>
                      <form action={verifySmsSetupAction} className="flex items-center gap-2">
                        <input
                          name="code"
                          placeholder={t('twofa.tokenPlaceholder')}
                          inputMode="numeric"
                          pattern="\d*"
                          className="h-10 w-28 rounded-xl bg-white/5 border border-white/15 px-3 outline-none focus:ring-2 focus:ring-white/20"
                          aria-label={t('twofa.smsCodeAria')}
                        />
                        <button
                          type="submit"
                          className="h-10 px-3 rounded-full border border-white/15 bg-white/10 hover:bg-white/15 text-sm"
                        >
                          {t('twofa.confirm')}
                        </button>
                      </form>
                      <form action={startSmsSetupAction}>
                        <button
                          type="submit"
                          className="h-10 px-3 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-sm"
                          title={t('twofa.resendTitle')}
                        >
                          {t('twofa.resend')}
                        </button>
                      </form>
                    </>
                  )}
                  <form action={disableSmsNumberAction}>
                    <button
                      type="submit"
                      className="h-10 px-3 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-sm"
                      title={t('twofa.sms.removeNumberTitle')}
                      disabled={!phoneReady}
                    >
                      {t('twofa.sms.removeNumber')}
                    </button>
                  </form>
                </div>
              )}

              {smsActive && (
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <form action={disableSms2FAAction}>
                    <button
                      type="submit"
                      className="h-10 px-3 rounded-full border border-white/15 bg-white/10 hover:bg-white/15 text-sm"
                      title={t('twofa.sms.disable2faTitle')}
                    >
                      {t('twofa.sms.disable2fa')}
                    </button>
                  </form>
                  <form action={disableSmsNumberAction}>
                    <button
                      type="submit"
                      className="h-10 px-3 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 text-sm"
                      title={t('twofa.sms.removeNumberTitle')}
                    >
                      {t('twofa.sms.removeNumber')}
                    </button>
                  </form>
                </div>
              )}

              {!smsActive && !phoneReady && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/70">
                  <span>{t('twofa.smsAddPhoneHintStart')}</span>

                  <Link
                    href={`/${locale}/profile`}
                    aria-label={tRoot('links.settings')}
                    title={tRoot('links.settings')}
                    className="
                      inline-flex items-center gap-1.5
                      px-3 py-1.5 rounded-full
                      border border-white/15 bg-white/10
                      hover:bg-white/15 active:bg-white/20
                      transition shadow-sm
                      focus:outline-none focus:ring-2 focus:ring-[var(--purple)]/50
                    "
                  >
                    {/* kleines Zahnrad-Icon */}
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
                      <path d="M19.4 15a1.8 1.8 0 0 0 .36 2l.07.07a2 2 0 1 1-2.83 2.83l-.07-.07a1.8 1.8 0 0 0-2-.36 1.8 1.8 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.07a1.8 1.8 0 0 0-1-1.6 1.8 1.8 0 0 0-2 .36l-.07.07A2 2 0 1 1 3.5 17l.07-.07a1.8 1.8 0 0 0 .36-2 1.8 1.8 0 0 0-1.6-1H2.25a2 2 0 1 1 0-4h.07a1.8 1.8 0 0 0 1.6-1 1.8 1.8 0 0 0-.36-2L3.5 6.07A2 2 0 1 1 6.33 3.24l.07.07a1.8 1.8 0 0 0 2 .36h.01A1.8 1.8 0 0 0 9.4 2.1V2a2 2 0 1 1 4 0v.07a1.8 1.8 0 0 0 1 1.6 1.8 1.8 0 0 0 2-.36l.07-.07A2 2 0 1 1 20.76 6.33l-.07.07a1.8 1.8 0 0 0-.36 2 1.8 1.8 0 0 0 1.6 1h.07a2 2 0 1 1 0 4h-.07a1.8 1.8 0 0 0-1.6 1Z" />
                    </svg>

                    <span className="font-medium">{tRoot('links.settings')}</span>

                    {/* Chevron für „klickbar“ */}
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>

                  <span>{t('twofa.smsAddPhoneHintEnd')}</span>
                </div>
              )}

              {smsActive && (
                <div className="mt-2 text-sm text-white/70">
                  {t('twofa.sms.loginSendsToPrefix')}{' '}
                  <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5">
                    {maskPhone(user.phone!)}
                  </span>
                  .
                </div>
              )}
            </div>

            {/* TOTP */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium">{t('twofa.totpTitle')}</h3>
              </div>

              {totpActive ? (
                <>
                  <p className="text-sm text-emerald-300 mb-2">{t('twofa.active')}</p>
                  <form action={disable2FAAction}>
                    <button className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-sm">
                      {t('twofa.disable')}
                    </button>
                  </form>
                </>
              ) : (
                <>
                  {!user.twoFactorTempSecret && (
                    <form action={startTotpSetupAction}>
                      <button className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-sm">
                        {t('twofa.setup')}
                      </button>
                    </form>
                  )}

                  {user.twoFactorTempSecret && qrDataUrl && (
                    <div className="mt-3 rounded-md border border-white/10 p-3">
                      <p className="text-sm mb-2">{t('twofa.scanIntro')}</p>
                      <div className="w-40 h-40 relative mb-3">
                        <Image
                          src={qrDataUrl}
                          alt={t('twofa.qrAlt')}
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
                          placeholder={t('twofa.tokenPlaceholder')}
                          className="w-32 rounded-md bg-white/5 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-white/20"
                          aria-label={t('twofa.tokenAria')}
                        />
                        <button
                          type="submit"
                          className="px-3 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-sm"
                        >
                          {t('twofa.confirm')}
                        </button>
                      </form>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {/* Extra Password & Sessions */}
          <section className="rounded-lg border border-white/10 p-4">
            <h2 className="text-base font-semibold mb-2">{t('extraPassword.title')}</h2>
            <p className="text-sm text-white/70 mb-4">{t('extraPassword.desc')}</p>

            <form action={togglePasswordResetProtectionAction}>
              <button
                type="submit"
                className="px-4 py-2 rounded-full border border-white/15 bg-white/10 hover:bg-white/15"
                title={t('extraPassword.toggle.title')}
              >
                {user.passwordResetProtection ? t('extraPassword.toggle.disable') : t('extraPassword.toggle.enable')}
              </button>
            </form>

            <div className="mt-6">
              <h3 className="font-medium mb-2">{t('sessions.title')}</h3>
              <p className="text-sm text-white/70 mb-3">{t('sessions.desc')}</p>
              <form action={logoutAllSessionsAction}>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-full border border-white/15 bg-white/10 hover:bg-white/15"
                >
                  {t('sessions.endAll')}
                </button>
              </form>
            </div>
          </section>
        </div>
      </section>
    </Viewport>
  );
}

/** Vollbild-Wrapper: Hintergrund füllt die Seite; Scrollen nur im Inhalt */
function Viewport({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-0 bg-black bg-gradient-to-b from-black to-[#0b0b0b]">
      <div className="h-full overflow-y-auto overscroll-contain">
        <div className="px-3 sm:px-4 py-4 sm:py-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ===== Kleine Callout-Komponenten ===== */
function SuccessCallout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 text-emerald-100 px-3 py-2 text-sm">
      {children}
    </div>
  );
}
function InfoCallout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-blue-400/30 bg-blue-400/10 text-blue-100 px-3 py-2 text-sm">
      {children}
    </div>
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
