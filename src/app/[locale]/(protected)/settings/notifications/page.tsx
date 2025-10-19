// src/app/[locale]/settings/notifications/page.tsx
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import BackButton from '@/components/BackButtonStandard';

// i18n: manuelles Laden + createTranslator (wie bei Monetization)
import { createTranslator } from 'next-intl';
import { notFound } from 'next/navigation';

type Params = { locale: string };

/* ----------------------------- Defaults/Types ----------------------------- */

type NotifSettings = {
  pushEnabled: boolean;

  uiSound: boolean;   // Ding abspielen?
  uiPopup: boolean;   // Mini-Popup anzeigen?

  // DM / Chat
  dmMessages: boolean;
  dmReactions: boolean;

  // Feed & Aktivitäten
  mentions: boolean;
  comments: boolean;
  likes: boolean;
  newFollowers: boolean;

  // Filter (Stummschalten/Anforderungen)
  muteNotFollowing: boolean;
  muteNotFollowers: boolean;
  muteNewAccounts: boolean;
  muteNoAvatar: boolean;
  requirePhoneVerified: boolean;
};

const DEFAULTS: NotifSettings = {
  pushEnabled: true,

  uiSound: true,
  uiPopup: true,

  dmMessages: true,
  dmReactions: true,

  mentions: true,
  comments: true,
  likes: true,
  newFollowers: true,

  muteNotFollowing: false,
  muteNotFollowers: false,
  muteNewAccounts: false,
  muteNoAvatar: false,
  requirePhoneVerified: false,
};

/* ------------------------------ SQL Utilities ----------------------------- */

// Zur Laufzeit sicherstellen, dass es die Tabelle gibt (keine Migration nötig)
async function ensureSettingsTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "UserNotificationSettings" (
      "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
      "pushEnabled" BOOLEAN NOT NULL DEFAULT true,

      "uiSound" BOOLEAN NOT NULL DEFAULT true,
      "uiPopup"  BOOLEAN NOT NULL DEFAULT true,

      "dmMessages" BOOLEAN NOT NULL DEFAULT true,
      "dmReactions" BOOLEAN NOT NULL DEFAULT true,

      "mentions" BOOLEAN NOT NULL DEFAULT true,
      "comments" BOOLEAN NOT NULL DEFAULT true,
      "likes" BOOLEAN NOT NULL DEFAULT true,
      "newFollowers" BOOLEAN NOT NULL DEFAULT true,

      "emailMessages" BOOLEAN NOT NULL DEFAULT false,
      "emailDigest" BOOLEAN NOT NULL DEFAULT false,

      "muteNotFollowing" BOOLEAN NOT NULL DEFAULT false,
      "muteNotFollowers" BOOLEAN NOT NULL DEFAULT false,
      "muteNewAccounts" BOOLEAN NOT NULL DEFAULT false,
      "muteNoAvatar" BOOLEAN NOT NULL DEFAULT false,
      "requirePhoneVerified" BOOLEAN NOT NULL DEFAULT false,

      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "UserNotificationSettings"
      ADD COLUMN IF NOT EXISTS "uiSound" BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "uiPopup"  BOOLEAN NOT NULL DEFAULT true;
  `);
}

async function readSettings(userId: string): Promise<NotifSettings> {
  await ensureSettingsTable();
  const rows = await prisma.$queryRaw<Array<NotifSettings>>`
    SELECT
      "pushEnabled",
      "uiSound", "uiPopup",
      "dmMessages", "dmReactions",
      "mentions", "comments", "likes", "newFollowers",
      "muteNotFollowing", "muteNotFollowers", "muteNewAccounts", "muteNoAvatar",
      "requirePhoneVerified"
    FROM "UserNotificationSettings"
    WHERE "userId" = ${userId}
    LIMIT 1
  `;

  if (!rows.length) return DEFAULTS;
  return { ...DEFAULTS, ...rows[0] };
}

function boolFromForm(form: FormData, key: keyof NotifSettings): boolean {
  return form.get(key) === 'on' || form.get(key) === 'true';
}

async function upsertSettings(userId: string, form: FormData) {
  const values: NotifSettings = {
    pushEnabled:              boolFromForm(form, 'pushEnabled'),

    uiSound:                  boolFromForm(form, 'uiSound'),
    uiPopup:                  boolFromForm(form, 'uiPopup'),

    dmMessages:               boolFromForm(form, 'dmMessages'),
    dmReactions:              boolFromForm(form, 'dmReactions'),

    mentions:                 boolFromForm(form, 'mentions'),
    comments:                 boolFromForm(form, 'comments'),
    likes:                    boolFromForm(form, 'likes'),
    newFollowers:             boolFromForm(form, 'newFollowers'),

    muteNotFollowing:         boolFromForm(form, 'muteNotFollowing'),
    muteNotFollowers:         boolFromForm(form, 'muteNotFollowers'),
    muteNewAccounts:          boolFromForm(form, 'muteNewAccounts'),
    muteNoAvatar:             boolFromForm(form, 'muteNoAvatar'),
    requirePhoneVerified:     boolFromForm(form, 'requirePhoneVerified'),
  };

  await ensureSettingsTable();

  await prisma.$executeRaw/*
    POSTGRES
  */`
    INSERT INTO "UserNotificationSettings" (
      "userId",
      "pushEnabled",
      "uiSound", "uiPopup",
      "dmMessages", "dmReactions",
      "mentions", "comments", "likes", "newFollowers",
      "muteNotFollowing", "muteNotFollowers", "muteNewAccounts", "muteNoAvatar",
      "requirePhoneVerified",
      "updatedAt"
    )
    VALUES (
      ${userId},
      ${values.pushEnabled},
      ${values.uiSound}, ${values.uiPopup},
      ${values.dmMessages}, ${values.dmReactions},
      ${values.mentions}, ${values.comments}, ${values.likes}, ${values.newFollowers},
      ${values.muteNotFollowing}, ${values.muteNotFollowers}, ${values.muteNewAccounts}, ${values.muteNoAvatar},
      ${values.requirePhoneVerified},
      NOW()
    )
    ON CONFLICT ("userId") DO UPDATE SET
      "pushEnabled" = EXCLUDED."pushEnabled",
      "uiSound"     = EXCLUDED."uiSound",
      "uiPopup"     = EXCLUDED."uiPopup",
      "dmMessages" = EXCLUDED."dmMessages",
      "dmReactions" = EXCLUDED."dmReactions",
      "mentions" = EXCLUDED."mentions",
      "comments" = EXCLUDED."comments",
      "likes" = EXCLUDED."likes",
      "newFollowers" = EXCLUDED."newFollowers",
      "muteNotFollowing" = EXCLUDED."muteNotFollowing",
      "muteNotFollowers" = EXCLUDED."muteNotFollowers",
      "muteNewAccounts" = EXCLUDED."muteNewAccounts",
      "muteNoAvatar" = EXCLUDED."muteNoAvatar",
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
  revalidatePath('/[locale]/settings/notifications', 'page');
}

export async function resetNotificationsAction() {
  'use server';
  const me = await getCurrentUser().catch(() => null);
  if (!me) throw new Error('Nicht angemeldet');

  await ensureSettingsTable();
  await prisma.$executeRaw`
    DELETE FROM "UserNotificationSettings" WHERE "userId" = ${me.id}
  `;
  revalidatePath('/[locale]/settings/notifications', 'page');
}

/* --------------------------------- Page UI -------------------------------- */

export default async function NotificationsPage({
  params,
}: {
  params: Params;
}) {
  const { locale } = await params;
  const me = await getCurrentUser().catch(() => null);

  // i18n-Datei manuell laden und Translator erstellen (Namespace: "notifications")
  let t: ReturnType<typeof createTranslator>;
  try {
    const notificationsFile = (await import(`@/messages/${locale}/notifications.json`)).default;
    t = createTranslator({
      locale,
      messages: notificationsFile,
      namespace: 'notifications',
    });
  } catch {
    notFound();
  }

  if (!me) {
    return (
      <section className="rounded-xl border border-white/10 overflow-hidden">
        <header className="px-4 pt-3 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Link href={`/${locale}/settings`} className="p-1" aria-label={t('ariaBack')}>
              <ChevronLeftIcon />
            </Link>
            <div>
              <h1 className="text-lg font-semibold">{t('title')}</h1>
              <p className="text-sm text-white/60">{t('notSignedInNote')}</p>
            </div>
          </div>
        </header>
        <div className="p-6 text-white/80">{t('notSignedInIntro')}</div>
      </section>
    );
  }

  const s = await readSettings(me.id);

  // Strings für das eingebettete Script vorab holen (wie in Monetization)
  const savingLabel = JSON.stringify(t('actions.saving') || 'Saving…');
  const saveLabel   = JSON.stringify(t('actions.save') || 'Save settings');
  const savedMsg    = JSON.stringify(t('actions.savedAria') || 'Settings have been saved.');

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
            <h1 className="text-lg font-semibold">{t('title')}</h1>
            <p className="text-sm text-white/60">{t('intro')}</p>
          </div>
        </div>
      </header>

      {/* Toast / Save-Feedback – zentriert im Viewport */}
      <div
        id="save-toast"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed left-1/2 top-1/2 z-50 hidden -translate-x-1/2 -translate-y-1/2 transform rounded-full border border-white/15 bg-black/70 px-4 py-2 text-sm text-white/90 shadow-lg backdrop-blur"
      >
        <span id="save-toast-text">{t('actions.savedAria')}</span>
      </div>

      <form action={saveNotificationsAction} className="grid gap-6 p-4" id="notifications-form">
        {/* Anzeige & Sound */}
        <Card title={t('cards.ui.title')}>
          <Toggle name="uiPopup" label={t('cards.ui.popup')} defaultChecked={s.uiPopup} />
          <Toggle name="uiSound" label={t('cards.ui.sound')} defaultChecked={s.uiSound} />
          <p className="text-xs text-white/50">
            {t('cards.ui.note')}
          </p>
        </Card>

        {/* Global */}
        <Card title={t('cards.push.title')}>
          <Toggle name="pushEnabled" label={t('cards.push.toggleActive')} defaultChecked={s.pushEnabled} />
          <p className="text-xs text-white/50">{t('cards.push.note')}</p>
        </Card>

        {/* Direktnachrichten */}
        <Card title={t('cards.dm.title')}>
          <Toggle name="dmMessages" label={t('cards.dm.messages')} defaultChecked={s.dmMessages} />
          <Toggle name="dmReactions" label={t('cards.dm.reactions')} defaultChecked={s.dmReactions} />
        </Card>

        {/* Feed & Aktivitäten */}
        <Card title={t('cards.feed.title')}>
          <Toggle name="mentions" label={t('cards.feed.mentions')} defaultChecked={s.mentions} />
          <Toggle name="comments" label={t('cards.feed.comments')} defaultChecked={s.comments} />
          <Toggle name="likes" label={t('cards.feed.likes')} defaultChecked={s.likes} />
          <Toggle name="newFollowers" label={t('cards.feed.newFollowers')} defaultChecked={s.newFollowers} />
        </Card>

        {/* Stummschalt-Filter */}
        <Card title={t('cards.filters.title')}>
          <Toggle name="muteNotFollowing" label={t('cards.filters.notFollowing')} defaultChecked={s.muteNotFollowing} />
          <Toggle name="muteNotFollowers" label={t('cards.filters.notFollowers')} defaultChecked={s.muteNotFollowers} />
          <Toggle name="muteNewAccounts" label={t('cards.filters.newAccounts')} defaultChecked={s.muteNewAccounts} />
          <Toggle name="muteNoAvatar" label={t('cards.filters.noAvatar')} defaultChecked={s.muteNoAvatar} />
          <Toggle name="requirePhoneVerified" label={t('cards.filters.phoneUnverified')} defaultChecked={s.requirePhoneVerified} />
          <p className="text-xs text-white/50">
            {t('cards.filters.note')}
          </p>
        </Card>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="submit"
            className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 data-[busy=true]:opacity-60"
            aria-label={t('actions.save')}
            title={t('actions.save')}
            id="save-button"
          >
            {t('actions.save')}
          </button>

          {/* Server Action direkt am Button */}
          <button
            type="submit"
            formAction={resetNotificationsAction}
            className="px-4 py-2 rounded-full border border-red-400/40 text-red-200/90 hover:bg-red-500/10"
            title={t('actions.resetTitle')}
            aria-label={t('actions.reset')}
            id="reset-button"
          >
            {t('actions.reset')}
          </button>
        </div>

        {/* Client: lokaler Pref-Sync + submit per fetch + Toast */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                var form = document.getElementById('notifications-form');
                if(!form) return;

                // ---------- UI Pref Sync ----------
                function read(){
                  var popup = !!form.querySelector('input[name="uiPopup"]')?.checked;
                  var sound = !!form.querySelector('input[name="uiSound"]')?.checked;
                  return { popup: popup, sound: sound };
                }
                function sync(){
                  var p = read();
                  try {
                    localStorage.setItem('uiNotiPopup', p.popup ? '1' : '0');
                    localStorage.setItem('uiNotiSound', p.sound ? '1' : '0');
                    window.dispatchEvent(new CustomEvent('ui:noti-prefs', { detail: p }));
                  } catch(e) {}
                }
                form.addEventListener('change', sync);
                sync();

                // ---------- Toast helpers (zentriert) ----------
                var toast = document.getElementById('save-toast');
                var toastText = document.getElementById('save-toast-text');
                function showToast(msg){
                  if(!toast) return;
                  if(msg && toastText) toastText.textContent = msg;
                  toast.classList.remove('hidden');
                  toast.classList.add('opacity-0');
                  requestAnimationFrame(function(){
                    toast.classList.remove('opacity-0');
                  });
                  setTimeout(hideToast, 2000);
                }
                function hideToast(){
                  if(!toast) return;
                  toast.classList.add('opacity-0');
                  setTimeout(function(){ toast.classList.add('hidden'); }, 200);
                }
                (function injectStyles(){
                  var id='toast-fade-style';
                  if(document.getElementById(id)) return;
                  var s=document.createElement('style');
                  s.id=id;
                  s.textContent = '#save-toast{transition:opacity .2s ease;}';
                  document.head.appendChild(s);
                })();

                // ---------- Submit per fetch zur API-Route ----------
                var saveBtn = document.getElementById('save-button');
                var resetBtn = document.getElementById('reset-button');
                var savingLabel = ${savingLabel};
                var saveLabel   = ${saveLabel};
                var savedMsg    = ${savedMsg};

                async function submitServerAction(ev){
                  ev.preventDefault();
                  var submitter = ev.submitter || document.activeElement;

                  // Speichern: POST an unsere API-Route
                  if (submitter !== resetBtn) {
                    if (saveBtn) {
                      saveBtn.dataset.busy = 'true';
                      saveBtn.setAttribute('aria-busy', 'true');
                      saveBtn.setAttribute('disabled', 'true');
                      saveBtn.textContent = savingLabel;
                    }
                    try {
                      var fd = new FormData(form);
                      await fetch('/api/settings/notifications', {
                        method: 'POST',
                        body: fd,
                        credentials: 'include'
                      });
                      showToast(savedMsg);
                    } catch (err) {
                      console.error(err);
                      showToast('Something went wrong. Please try again.');
                    } finally {
                      if (saveBtn) {
                        saveBtn.dataset.busy = 'false';
                        saveBtn.removeAttribute('aria-busy');
                        saveBtn.removeAttribute('disabled');
                        saveBtn.textContent = saveLabel;
                      }
                    }
                    return;
                  }

                  // Reset bleibt als echte Server Action.
                }

                form.addEventListener('submit', submitServerAction);
                window.addEventListener('keydown', function(ev){ if(ev.key === 'Escape') hideToast(); });
              })();
            `,
          }}
        />
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
