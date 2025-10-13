// src/app/api/settings/notifications/route.ts
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

// --- Types/Defaults (gleich wie auf der Page; kurz gehalten) ---
type NotifSettings = {
  pushEnabled: boolean;
  uiSound: boolean; uiPopup: boolean;
  dmMessages: boolean; dmReactions: boolean;
  mentions: boolean; comments: boolean; likes: boolean; newFollowers: boolean;
  emailMessages: boolean; emailDigest: boolean;
  muteNotFollowing: boolean; muteNotFollowers: boolean; muteNewAccounts: boolean; muteNoAvatar: boolean;
  requireEmailVerified: boolean; requirePhoneVerified: boolean;
};

async function ensureSettingsTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "UserNotificationSettings" (
      "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
      "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
      "uiSound" BOOLEAN NOT NULL DEFAULT true,
      "uiPopup" BOOLEAN NOT NULL DEFAULT true,
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

function b(form: FormData, key: keyof NotifSettings) {
  return form.get(key) === 'on' || form.get(key) === 'true';
}

async function upsertSettings(userId: string, form: FormData) {
  const values: NotifSettings = {
    pushEnabled: b(form, 'pushEnabled'),
    uiSound: b(form, 'uiSound'), uiPopup: b(form, 'uiPopup'),
    dmMessages: b(form, 'dmMessages'), dmReactions: b(form, 'dmReactions'),
    mentions: b(form, 'mentions'), comments: b(form, 'comments'),
    likes: b(form, 'likes'), newFollowers: b(form, 'newFollowers'),
    emailMessages: b(form, 'emailMessages'), emailDigest: b(form, 'emailDigest'),
    muteNotFollowing: b(form, 'muteNotFollowing'), muteNotFollowers: b(form, 'muteNotFollowers'),
    muteNewAccounts: b(form, 'muteNewAccounts'), muteNoAvatar: b(form, 'muteNoAvatar'),
    requireEmailVerified: b(form, 'requireEmailVerified'), requirePhoneVerified: b(form, 'requirePhoneVerified'),
  };

  await ensureSettingsTable();
  await prisma.$executeRaw/* POSTGRES */`
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
      "uiSound" = EXCLUDED."uiSound",
      "uiPopup" = EXCLUDED."uiPopup",
      "dmMessages" = EXCLUDED."dmMessages",
      "dmReactions" = EXCLUDED."dmReactions",
      "mentions" = EXCLUDED."mentions",
      "comments" = EXCLUDED."comments",
      "likes" = EXCLUDED."likes",
      "newFollowers" = EXCLUDED."newFollowers",
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

export async function POST(req: Request) {
  const me = await getCurrentUser().catch(() => null);
  if (!me) return new Response('Unauthorized', { status: 401 });

  const form = await req.formData();
  await upsertSettings(me.id, form);

  // Optional: revalidate server-rendered page
  // (kannst du auch weglassen, da wir im Client kein Reload machen)
  return Response.json({ ok: true });
}
