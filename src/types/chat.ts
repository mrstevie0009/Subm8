export type UserRole = 'domme' | 'submissive';

export type ChatUser = {
  id: string;
  displayName: string;
  username: string;     // handle ohne @
  role: UserRole;
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
  mediaUrl?: string;
  createdAt: string; // ISO
  seen?: boolean;
};

export type Conversation = {
  id: string;
  other: ChatUser;             // Chatpartner:in
  lastMessageAt: string;       // ISO
  lastSnippet: string;
  unread?: number;
};
