// src/app/api/chat/route.ts
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { $Enums, Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

// --- selektiertes Shape für DMs (as const, damit TS die Felder "domme"/"sub" kennt)
const dmSelect = {
  id: true, createdAt: true, updatedAt: true,
  dommeId: true, subId: true,
  domme: { select: { id: true, handle: true, displayName: true, avatarUrl: true, role: true, premiumUntil: true, isFirstAdopter: true } },
  sub:   { select: { id: true, handle: true, displayName: true, avatarUrl: true, role: true, premiumUntil: true, isFirstAdopter: true } },
  lastMessageId: true,
  lastMessageAt: true,
  unreadForDomme: true,
  unreadForSub: true,
} as const;

type DMRow = Prisma.ConversationGetPayload<{ select: typeof dmSelect }>;

export async function GET() {
  const me = await getCurrentUser();
  if (!me) {
    return Response.json(
      { ok: true, items: [] },
      { status: 200, headers: { 'cache-control': 'private, no-store' } },
    );
  }

  /* ---------------- DMs (wie bisher) ---------------- */
  const dms: DMRow[] = await prisma.conversation.findMany({
    where: {
      type: $Enums.ConversationType.DM,
      OR: [
        { dommeId: me.id, hiddenForDomme: null },
        { subId:   me.id, hiddenForSub:   null },
      ],
    },
    orderBy: { updatedAt: 'desc' },
    select: dmSelect,
  });

  /* ---------------- Groups ----------------
     Wichtig: gleiche Tabelle, Filter über type=GROUP + Mitgliedschaft
  ----------------------------------------------------- */
  const groups = await prisma.conversation.findMany({
    where: {
      type: $Enums.ConversationType.GROUP,
      members: { some: { userId: me.id } },   // Mitglied sein
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      title: true,
      avatarUrl: true,
      createdAt: true,
      updatedAt: true,
      lastMessageId: true,
      lastMessageAt: true,
      // Unread für den aktuellen User
      members: {
        where: { userId: me.id },
        select: { unreadCount: true },
      },
      // Falls du irgendwann ein Gruppen-Avatarfeld in Conversation hast:
      // avatarUrl: true,
    },
  });

  /* ---------------- Letzte Messages (für beide Typen) ---------------- */
  const lastIds = [
    ...dms.map(c => c.lastMessageId).filter(Boolean) as string[],
    ...groups.map(g => g.lastMessageId).filter(Boolean) as string[],
  ];
  const lastMsgs = lastIds.length
    ? await prisma.message.findMany({
        where: { id: { in: lastIds } },
        select: {
          id: true, text: true, createdAt: true, authorId: true,
          mediaType: true, mediaUrl: true,
        },
      })
    : [];
  const lastById = new Map(lastMsgs.map(m => [String(m.id), m]));

  // --- shared types for the response (match your chat list normalizer)
type MediaKind = 'image' | 'video' | 'audio' | 'file';

type DMItem = {
  id: string;
  other: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    role: $Enums.Role;
    premiumUntil: string | null;
    isFirstAdopter: boolean;
  };
  lastMessageAt: string;
  lastSnippet: string;
  lastAuthorId: string | null;
  unread: number;
  lastMediaType?: MediaKind;
};

type GroupItem = {
  kind: 'group';
  id: string;
  title: string;
  groupAvatarUrl: string | null;
  memberCount?: number;
  lastMessageAt: string;
  lastSnippet: string;
  lastAuthorId: string | null;
  unread: number;
  lastMediaType?: MediaKind;
};

// -------------- normalize DMs --------------
const dmItems: DMItem[] = dms
  .map<DMItem | undefined>((dm) => {
    const iAmDomme = dm.dommeId === me.id;
    const other = iAmDomme ? dm.sub : dm.domme;
    if (!other) return undefined;

    const last = dm.lastMessageId ? lastById.get(String(dm.lastMessageId)) : undefined;
    const mediaKind: MediaKind | undefined =
      last?.mediaType
        ? last.mediaType.startsWith('image/') ? 'image'
          : last.mediaType.startsWith('video/') ? 'video'
          : last.mediaType.startsWith('audio/') ? 'audio'
          : 'file'
        : undefined;

    const normalizedText = (last?.text ?? '')
      .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const lastSnippet = normalizedText || (mediaKind ? `MEDIA::${mediaKind}` : '');

    return {
      id: dm.id,
      other: {
        id: other.id,
        username: other.handle,
        displayName: other.displayName,
        avatarUrl: other.avatarUrl,
        role: other.role,
        premiumUntil: other.premiumUntil ? other.premiumUntil.toISOString() : null,
        isFirstAdopter: other.isFirstAdopter ?? false,
      },
      lastMessageAt: (dm.lastMessageAt ?? dm.updatedAt ?? dm.createdAt).toISOString(),
      lastSnippet,
      lastAuthorId: last?.authorId ?? null,
      unread: iAmDomme ? dm.unreadForDomme : dm.unreadForSub,
      lastMediaType: mediaKind,
    };
  })
  .filter((x): x is DMItem => !!x);

// -------------- normalize Groups --------------
const groupItems: GroupItem[] = groups.map<GroupItem>((g) => {
  const last = g.lastMessageId ? lastById.get(String(g.lastMessageId)) : undefined;

  const mediaKind: MediaKind | undefined =
    last?.mediaType
      ? last.mediaType.startsWith('image/') ? 'image'
        : last.mediaType.startsWith('video/') ? 'video'
        : last.mediaType.startsWith('audio/') ? 'audio'
        : 'file'
      : undefined;

  const normalizedText = (last?.text ?? '')
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const lastSnippet = normalizedText || (mediaKind ? `MEDIA::${mediaKind}` : '');
  const unread = g.members[0]?.unreadCount ?? 0;

  return {
    kind: 'group',
    id: g.id,
    title: g.title ?? 'Group',
    groupAvatarUrl: g.avatarUrl ?? null,
    lastMessageAt: (g.lastMessageAt ?? g.updatedAt ?? g.createdAt).toISOString(),
    lastSnippet,
    lastAuthorId: last?.authorId ?? null,
    unread,
    lastMediaType: mediaKind,
  };
});

// -------------- union + sort (by lastMessageAt) --------------
const items = [...dmItems, ...groupItems].sort(
  (a, b) => +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt)
);

return Response.json(
  { ok: true, items },
  { headers: { 'cache-control': 'private, no-store' } },
);
}
