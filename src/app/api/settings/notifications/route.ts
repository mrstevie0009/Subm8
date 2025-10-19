// src/app/api/settings/notifications/route.ts
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

/* ---------- Types/Defaults (wie auf der Page) ---------- */
type NotifSettings = {
  pushEnabled: boolean;
  uiSound: boolean; uiPopup: boolean;
  dmMessages: boolean; dmReactions: boolean;
  mentions: boolean; comments: boolean; likes: boolean; newFollowers: boolean;
  emailMessages: boolean; emailDigest: boolean;
  muteNotFollowing: boolean; muteNotFollowers: boolean; muteNewAccounts: boolean; muteNoAvatar: boolean;
  requireEmailVerified: boolean; requirePhoneVerified: boolean;
};

const DEFAULTS: NotifSettings = {
  pushEnabled: true,
  uiSound: true, uiPopup: true,
  dmMessages: true, dmReactions: true,
  mentions: true, comments: true, likes: true, newFollowers: true,
  emailMessages: false, emailDigest: false,
  muteNotFollowing: false, muteNotFollowers: false, muteNewAccounts: false, muteNoAvatar: false,
  requireEmailVerified: false, requirePhoneVerified: false,
};

/* ---------- Schema-Sicherung (idempotent) ---------- */
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
      "requireEmailVerified" BOOLEAN NOT NULL DEFAULT false,
      "requirePhoneVerified"  BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Falls aus älteren Ständen: fehlende Spalten/Defaults nachziehen.
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "UserNotificationSettings"
      ADD COLUMN IF NOT EXISTS "uiSound" BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "uiPopup"  BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "emailMessages" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "emailDigest"  BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "muteNotFollowing" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "muteNotFollowers" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "muteNewAccounts" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "muteNoAvatar" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "requireEmailVerified" BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "requirePhoneVerified"  BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
  `);
}

/* ---------- Parsing-Utils ---------- */
function toBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === 'on' || s === 'true' || s === '1' || s === 'yes' || s === 'y';
  }
  return false;
}

const KEYS: (keyof NotifSettings)[] = [
  'pushEnabled',
  'uiSound', 'uiPopup',
  'dmMessages', 'dmReactions',
  'mentions', 'comments', 'likes', 'newFollowers',
  'emailMessages', 'emailDigest',
  'muteNotFollowing', 'muteNotFollowers', 'muteNewAccounts', 'muteNoAvatar',
  'requireEmailVerified', 'requirePhoneVerified',
];

async function parseBodyToValues(req: Request): Promise<NotifSettings> {
  const ct = req.headers.get('content-type') || '';
  let incoming: Record<string, unknown> = {};

  if (ct.includes('application/json')) {
    try {
      const json = await req.json();
      if (json && typeof json === 'object') incoming = json as Record<string, unknown>;
    } catch {/* ignore */}
  } else {
    const form = await req.formData();
    for (const k of KEYS) {
      incoming[k] = form.get(k as string);
    }
  }

  // Nur erlaubte Keys übernehmen, Rest aus Defaults
  const out = { ...DEFAULTS };
  for (const k of KEYS) {
    if (k in incoming) out[k] = toBool(incoming[k]);
  }
  return out;
}

/* ---------- Upsert ---------- */
async function upsertSettings(userId: string, values: NotifSettings) {
  await ensureSettingsTable();
  await prisma.$executeRaw/* SQL */`
    INSERT INTO "UserNotificationSettings" (
      "userId","pushEnabled","uiSound","uiPopup","dmMessages","dmReactions",
      "mentions","comments","likes","newFollowers","emailMessages","emailDigest",
      "muteNotFollowing","muteNotFollowers","muteNewAccounts","muteNoAvatar",
      "requireEmailVerified","requirePhoneVerified","updatedAt"
    )
    VALUES (
      ${userId},
      ${values.pushEnabled}, ${values.uiSound}, ${values.uiPopup},
      ${values.dmMessages}, ${values.dmReactions},
      ${values.mentions}, ${values.comments}, ${values.likes}, ${values.newFollowers},
      ${values.emailMessages}, ${values.emailDigest},
      ${values.muteNotFollowing}, ${values.muteNotFollowers}, ${values.muteNewAccounts}, ${values.muteNoAvatar},
      ${values.requireEmailVerified}, ${values.requirePhoneVerified},
      NOW()
    )
    ON CONFLICT ("userId") DO UPDATE SET
      "pushEnabled" = EXCLUDED."pushEnabled",
      "uiSound"     = EXCLUDED."uiSound",
      "uiPopup"     = EXCLUDED."uiPopup",
      "dmMessages"  = EXCLUDED."dmMessages",
      "dmReactions" = EXCLUDED."dmReactions",
      "mentions"    = EXCLUDED."mentions",
      "comments"    = EXCLUDED."comments",
      "likes"       = EXCLUDED."likes",
      "newFollowers"= EXCLUDED."newFollowers",
      "emailMessages" = EXCLUDED."emailMessages",
      "emailDigest"   = EXCLUDED."emailDigest",
      "muteNotFollowing" = EXCLUDED."muteNotFollowing",
      "muteNotFollowers" = EXCLUDED."muteNotFollowers",
      "muteNewAccounts"  = EXCLUDED."muteNewAccounts",
      "muteNoAvatar"     = EXCLUDED."muteNoAvatar",
      "requireEmailVerified" = EXCLUDED."requireEmailVerified",
      "requirePhoneVerified"  = EXCLUDED."requirePhoneVerified",
      "updatedAt" = NOW();
  `;
}

/* ---------- Handler ---------- */
export async function POST(req: Request) {
  const me = await getCurrentUser().catch(() => null);
  if (!me) return new Response('Unauthorized', { status: 401 });

  const values = await parseBodyToValues(req);
  await upsertSettings(me.id, values);

  // Praktisch, wenn der Client Werte sofort braucht:
  return new Response(JSON.stringify({ ok: true, settings: values }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' },
  });
}
