//src/types/chat.ts
export type UserRole = 'domme' | 'submissive';

export type ChatUser = {
  id: string;
  displayName: string;
  username: string;     // handle ohne @
  role: 'domme' | 'submissive';
  avatarUrl?: string;
  online?: boolean;
  dmOpen?: boolean;     // darf Sub initiieren?
  nsfwVerified?: boolean;
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
