import type { Conversation, ChatMessage, ChatUser } from '@/types/chat';

export const AVATAR_PH = '/images/avatar-placeholder.png';

export const USERS: Record<string, ChatUser> = {
  me:   { id: 'me', displayName: 'You', username: 'you', role: 'submissive', avatarUrl: AVATAR_PH, online: true, dmOpen: true, nsfwVerified: true },
  maya: { id: 'maya', displayName: 'Maya the bad ass', username: 'maya', role: 'domme',     avatarUrl: AVATAR_PH, online: true, dmOpen: true },
  paul: { id: 'paul', displayName: 'Paul the Sub',     username: 'paul', role: 'submissive', avatarUrl: AVATAR_PH, online: false, dmOpen: false },
};

export const CONVERSATIONS: Conversation[] = [
  {
    id: 'c1',
    other: USERS.maya,
    lastMessageAt: new Date().toISOString(),
    lastSnippet: 'Let me see proof of your last task…',
    unread: 1,
  },
  {
    id: 'c2',
    other: USERS.paul,
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    lastSnippet: 'Thanks for the guidance 🙏',
  },
];

export const MESSAGES: Record<string, ChatMessage[]> = {
  c1: [
    { id: 'm1', convoId: 'c1', senderId: 'maya', text: 'Read the rules above and obey.', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), seen: true },
    { id: 'm2', convoId: 'c1', senderId: 'me',   text: 'Yes, Mistress.', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4.5).toISOString(), seen: true },
    { id: 'm3', convoId: 'c1', senderId: 'maya', text: 'Send proof of your last task.', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), seen: false },
  ],
  c2: [
    { id: 'n1', convoId: 'c2', senderId: 'me',   text: 'Welcome!', createdAt: new Date(Date.now() - 1000 * 60 * 50).toISOString(), seen: true },
    { id: 'n2', convoId: 'c2', senderId: 'paul', text: 'Thanks for the guidance 🙏', createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(), seen: true },
  ],
};
