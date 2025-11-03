//src/types/chat.ts
export type UserRole = 'domme' | 'submissive';

export type DbRole = 'DOMME' | 'SUBMISSIVE';

export type ThreadMessageDto = {
  id: string;
  at: string;                 // ISO
  authorId: string;
  text?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  read: boolean;
};

export type ThreadOk = {
  ok: true;
  me: { id: string; role: DbRole; avatarUrl?: string | null };
  other: {
    id: string;
    handle: string;
    displayName: string;
    avatarUrl: string | null;
    role: DbRole;
    // 🟣 neu:
    isFirstAdopter?: boolean;
    premiumUntil?: string | null;
  };
  messages: ThreadMessageDto[];
  viewerHasBlocked: boolean;
  isBlockedByOther: boolean;
  otherTyping?: boolean;
  pageSize?: number;
};

export type ThreadErr = { ok: false; error: string };
export type ThreadResponse = ThreadOk | ThreadErr;

export type ChatUser = {
  id: string;
  displayName: string;
  username: string;     // handle ohne @
  role: 'domme' | 'submissive';
  avatarUrl?: string;
  online?: boolean;
  dmOpen?: boolean;     // darf Sub initiieren?
  nsfwVerified?: boolean;

  // 🟣 neue Felder:
  isFirstAdopter?: boolean;
  premiumUntil?: string | null;
};

export type ChatMessage = {
  id: string;
  convoId: string;
  senderId: string;
  text?: string;
  mediaUrl?: string | null;
  createdAt: string; // ISO
  seen: boolean;
  mediaType?: string | null;   // ⬅︎ wichtig für „Video/Photo“ und Renderer
};

export type Conversation = {
  id: string;
  other: ChatUser;             // Chatpartner:in
  lastMessageAt: string;       // ISO
  lastSnippet: string;         // z.B. „Video“, „Photo“ oder Text
  unread?: number;
};
