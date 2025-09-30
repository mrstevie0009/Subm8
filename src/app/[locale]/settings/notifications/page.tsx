// src/app/[locale]/notifications/page.tsx
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { getTranslations } from 'next-intl/server';
import BackButton from '@/components/BackButtonStandard';

type Params = { locale: string };

/* ----------------------------- Defaults/Types ----------------------------- */

type NotifSettings = {
  pushEnabled: boolean;

  // DM / Chat
  dmMessages: boolean;
  dmReactions: boolean;

  // Feed & Aktivitäten
  mentions: boolean;
  comments: boolean;
  likes: boolean;
  newFollowers: boolean;
  photoTags: boolean;

  // E-Mail
  emailMessages: boolean;
  emailDigest: boolean;

  // Filter (Stummschalten/Anforderungen)
  muteNotFollowing: boolean;
  muteNotFollowers: boolean;
  muteNewAccounts: boolean;
  muteNoAvatar: boolean;
  requireEmailVerified: boolean;
  requirePhoneVerified: boolean;
};

const DEFAULTS: NotifSettings = {
  pushEnabled: true,

  dmMessages: true,
  dmReactions: true,

  mentions: true,
  comments: true,
  likes: true,
  newFollowers: true,
  photoTags: true,

  emailMessages: false,
  emailDigest: false,

  muteNotFollowing: false,
  muteNotFollowers: false,
  muteNewAccounts: false,
  muteNoAvatar: false,
  requireEmailVerified: false,
  requirePhoneVerified: false,
};

/* ------------------------------ SQL Utilities ----------------------------- */

// Zur Laufzeit sicherstellen, dass es die Tabelle gibt (keine Migration nötig)
async function ensureSettingsTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "UserNotificationSettings" (
      "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
      "pushEnabled" BOOLEAN NOT NULL DEFAULT true,

      "dmMessages" BOOLEAN NOT NULL DEFAULT true,
      "dmReactions" BOOLEAN NOT NULL DEFAULT true,

      "mentions" BOOLEAN NOT NULL DEFAULT true,
      "comments" BOOLEAN NOT NULL DEFAULT true,
      "likes" BOOLEAN NOT NULL DEFAULT true,
      "newFollowers" BOOLEAN NOT NULL DEFAULT true,
      "photoTags" BOOLEAN NOT NULL DEFAULT true,

      "emailMessages" BOOLEAN NOT NULL DEFAULT false,
      "emailDigest" BOOLEAN NOT NULL DEFAULT false,

      "muteNotFollowing" BOOLEAN NOT NULL DEFAULT false,
      "muteNotFollowers" BOOLEAN NOT NULL DEFAULT false,
      "muteNewAccounts" BOOLEAN NOT NULL DEFAULT false,
      "muteNoAvatar" BOOLEAN NOT NULL DEFAULT false,
      "requireEmailVerified" BOOLEAN NOT NULL DEFAULT false,
      "requirePhoneVerified" BOOLEAN NOT NULL DEFAULT false,

      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function readSettings(userId: string): Promise<NotifSettings> {
  await ensureSettingsTable();
  const rows = await prisma.$queryRaw<Array<NotifSettings>>`
    SELECT
      "pushEnabled",
      "dmMessages", "dmReactions",
      "mentions", "comments", "likes", "newFollowers", "photoTags",
      "emailMessages", "emailDigest",
      "muteNotFollowing", "muteNotFollowers", "muteNewAccounts", "muteNoAvatar",
      "requireEmailVerified", "requirePhoneVerified"
    FROM "UserNotificationSettings"
    WHERE "userId" = ${userId}
    LIMIT 1
  `;

  if (!rows.length) return DEFAULTS;
  return { ...DEFAULTS, ...rows[0] };
}

function boolFromForm(form: FormData, key: keyof NotifSettings): boolean {
  // Checkboxen schicken nur was, wenn checked
  return form.get(key) === 'on' || form.get(key) === 'true';
}

async function upsertSettings(userId: string, form: FormData) {
  const values: NotifSettings = {
    pushEnabled:              boolFromForm(form, 'pushEnabled'),

    dmMessages:               boolFromForm(form, 'dmMessages'),
    dmReactions:              boolFromForm(form, 'dmReactions'),

    mentions:                 boolFromForm(form, 'mentions'),
    comments:                 boolFromForm(form, 'comments'),
    likes:                    boolFromForm(form, 'likes'),
    newFollowers:             boolFromForm(form, 'newFollowers'),
    photoTags:                boolFromForm(form, 'photoTags'),

    emailMessages:            boolFromForm(form, 'emailMessages'),
    emailDigest:              boolFromForm(form, 'emailDigest'),

    muteNotFollowing:         boolFromForm(form, 'muteNotFollowing'),
    muteNotFollowers:         boolFromForm(form, 'muteNotFollowers'),
    muteNewAccounts:          boolFromForm(form, 'muteNewAccounts'),
    muteNoAvatar:             boolFromForm(form, 'muteNoAvatar'),
    requireEmailVerified:     boolFromForm(form, 'requireEmailVerified'),
    requirePhoneVerified:     boolFromForm(form, 'requirePhoneVerified'),
  };

  await ensureSettingsTable();

  await prisma.$executeRaw/*
    POSTGRES
  */`
    INSERT INTO "UserNotificationSettings" (
      "userId",
      "pushEnabled",
      "dmMessages", "dmReactions",
      "mentions", "comments", "likes", "newFollowers", "photoTags",
      "emailMessages", "emailDigest",
      "muteNotFollowing", "muteNotFollowers", "muteNewAccounts", "muteNoAvatar",
      "requireEmailVerified", "requirePhoneVerified",
      "updatedAt"
    )
    VALUES (
      ${userId},
      ${values.pushEnabled},
      ${values.dmMessages}, ${values.dmReactions},
      ${values.mentions}, ${values.comments}, ${values.likes}, ${values.newFollowers}, ${values.photoTags},
      ${values.emailMessages}, ${values.emailDigest},
      ${values.muteNotFollowing}, ${values.muteNotFollowers}, ${values.muteNewAccounts}, ${values.muteNoAvatar},
      ${values.requireEmailVerified}, ${values.requirePhoneVerified},
      NOW()
    )
    ON CONFLICT ("userId") DO UPDATE SET
      "pushEnabled" = EXCLUDED."pushEnabled",
      "dmMessages" = EXCLUDED."dmMessages",
      "dmReactions" = EXCLUDED."dmReactions",
      "mentions" = EXCLUDED."mentions",
      "comments" = EXCLUDED."comments",
      "likes" = EXCLUDED."likes",
      "newFollowers" = EXCLUDED."newFollowers",
      "photoTags" = EXCLUDED."photoTags",
      "emailMessages" = EXCLUDED."emailMessages",
      "emailDigest" = EXCLUDED."emailDigest",
      "muteNotFollowing" = EXCLUDED."muteNotFollowing",
      "muteNotFollowers" = EXCLUDED."muteNotFollowers",
      "muteNewAccounts" = EXCLUDED."muteNewAccounts",
      "muteNoAvatar" = EXCLUDED."muteNoAvatar",
      "requireEmailVerified" = EXCLUDED."requireEmailVerified",
      "requirePhoneVerified" = EXCLUDED."requirePhoneVerified",
      "updatedAt" = NOW();
  `;
}

/* --------------------------------- Actions -------------------------------- */

export async function saveNotificationsAction(formData: FormData) {
  'use server';
  const me = await getCurrentUser().catch(() => null);
  if (!me) throw new Error('Nicht angemeldet');

  await upsertSettings(me.id, formData);
  revalidatePath('/[locale]/notifications', 'page');
}

export async function resetNotificationsAction() {
  'use server';
  const me = await getCurrentUser().catch(() => null);
  if (!me) throw new Error('Nicht angemeldet');

  await ensureSettingsTable();
  await prisma.$executeRaw`
    DELETE FROM "UserNotificationSettings" WHERE "userId" = ${me.id}
  `;
  revalidatePath('/[locale]/notifications', 'page');
}

/* --------------------------------- Page UI -------------------------------- */

export default async function NotificationsPage({
  params,
}: {
  params: Params;
}) {
  const { locale } = await params;
  const me = await getCurrentUser().catch(() => null);
  const t = await getTranslations({ locale, namespace: 'common' });

  if (!me) {
    return (
      <section className="rounded-xl border border-white/10 overflow-hidden">
        <header className="px-4 pt-3 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Link href={`/${locale}/settings`} className="p-1" aria-label={t('notifications.ariaBack')}>
              <ChevronLeftIcon />
            </Link>
            <div>
              <h1 className="text-lg font-semibold">{t('notifications.title')}</h1>
              <p className="text-sm text-white/60">{t('notifications.notSignedInNote')}</p>
            </div>
          </div>
        </header>
        <div className="p-6 text-white/80">{t('notifications.notSignedInIntro')}</div>
      </section>
    );
  }

  const s = await readSettings(me.id);

  return (
    <section className="rounded-xl border border-white/10 overflow-hidden">
      <header className="px-4 pt-3 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <BackButton
                    fallbackHref={`/${locale}`}
                    ariaLabel={t('bookmarksPage.ariaBack')}
                    className="inline-flex items-center justify-center p-1 hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
                    style={{ color: 'var(--purple)' }}
                  >
                    <ChevronLeftIcon />
                  </BackButton>
                  <div className="ml-2 sm:ml-3">
            <h1 className="text-lg font-semibold">{t('notifications.title')}</h1>
            <p className="text-sm text-white/60">{t('notifications.intro')}</p>
          </div>
        </div>
      </header>

      <form action={saveNotificationsAction} className="grid gap-6 p-4">
        {/* Global */}
        <Card title={t('notifications.cards.push.title')}>
          <Toggle name="pushEnabled" label={t('notifications.cards.push.toggleActive')} defaultChecked={s.pushEnabled} />
          <p className="text-xs text-white/50">{t('notifications.cards.push.note')}</p>
        </Card>

        {/* Direktnachrichten */}
        <Card title={t('notifications.cards.dm.title')}>
          <Toggle name="dmMessages" label={t('notifications.cards.dm.messages')} defaultChecked={s.dmMessages} />
          <Toggle name="dmReactions" label={t('notifications.cards.dm.reactions')} defaultChecked={s.dmReactions} />
        </Card>

        {/* Feed & Aktivitäten */}
        <Card title={t('notifications.cards.feed.title')}>
          <Toggle name="mentions" label={t('notifications.cards.feed.mentions')} defaultChecked={s.mentions} />
          <Toggle name="comments" label={t('notifications.cards.feed.comments')} defaultChecked={s.comments} />
          <Toggle name="likes" label={t('notifications.cards.feed.likes')} defaultChecked={s.likes} />
          <Toggle name="newFollowers" label={t('notifications.cards.feed.newFollowers')} defaultChecked={s.newFollowers} />
          <Toggle name="photoTags" label={t('notifications.cards.feed.photoTags')} defaultChecked={s.photoTags} />
        </Card>

        {/* E-Mail */}
        <Card title={t('notifications.cards.email.title')}>
          <Toggle name="emailMessages" label={t('notifications.cards.email.messages')} defaultChecked={s.emailMessages} />
          <Toggle name="emailDigest" label={t('notifications.cards.email.digest')} defaultChecked={s.emailDigest} />
          <p className="text-xs text-white/50">{t('notifications.cards.email.note')}</p>
        </Card>

        {/* Stummschalt-Filter */}
        <Card title={t('notifications.cards.filters.title')}>
          <Toggle name="muteNotFollowing" label={t('notifications.cards.filters.notFollowing')} defaultChecked={s.muteNotFollowing} />
          <Toggle name="muteNotFollowers" label={t('notifications.cards.filters.notFollowers')} defaultChecked={s.muteNotFollowers} />
          <Toggle name="muteNewAccounts" label={t('notifications.cards.filters.newAccounts')} defaultChecked={s.muteNewAccounts} />
          <Toggle name="muteNoAvatar" label={t('notifications.cards.filters.noAvatar')} defaultChecked={s.muteNoAvatar} />
          <Toggle name="requireEmailVerified" label={t('notifications.cards.filters.emailUnverified')} defaultChecked={s.requireEmailVerified} />
          <Toggle name="requirePhoneVerified" label={t('notifications.cards.filters.phoneUnverified')} defaultChecked={s.requirePhoneVerified} />
          <p className="text-xs text-white/50">
            {t('notifications.cards.filters.note')}
          </p>
        </Card>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="submit"
            className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/15"
          >
            {t('notifications.actions.save')}
          </button>

          <form action={resetNotificationsAction}>
            <button
              type="submit"
              className="px-4 py-2 rounded-full border border-red-400/40 text-red-200/90 hover:bg-red-500/10"
              title={t('notifications.actions.resetTitle')}
            >
              {t('notifications.actions.reset')}
            </button>
          </form>
        </div>
      </form>
    </section>
  );
}

/* --------------------------------- UI Bits -------------------------------- */

function Card(props: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-white/10 p-4">
      <h2 className="text-base font-semibold mb-3">{props.title}</h2>
      <div className="grid gap-3">{props.children}</div>
    </section>
  );
}

function Toggle(props: { name: keyof NotifSettings; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm">{props.label}</span>
      <input
        type="checkbox"
        name={props.name}
        defaultChecked={props.defaultChecked}
        className="h-4 w-4 accent-white/90"
      />
    </label>
  );
}

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
