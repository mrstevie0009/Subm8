'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import ChatHeader from '@/components/ChatHeader';
import ChatComposer from '@/components/ChatComposer';
import TipModal from '@/components/TipModal';
import { CONVERSATIONS, MESSAGES, USERS } from '@/data/chatSeed';
import type { ChatMessage } from '@/types/chat';

export default function ChatThreadPage() {
  const { id } = useParams<{ id: string }>();

  // Conversation & Partner:in suchen (stabilisiert via useMemo)
  const convo = React.useMemo(() => CONVERSATIONS.find((c) => c.id === id), [id]);
  const other = convo?.other ?? null;
  const me = USERS.me;

  // Seed-Nachrichten nur einmal initial übernehmen
  const seed = React.useMemo<ChatMessage[]>(
    () => (id && MESSAGES[id] ? [...MESSAGES[id]] : []),
    [id]
  );

  const [messages, setMessages] = React.useState<ChatMessage[]>(seed);
  const [tipOpen, setTipOpen] = React.useState(false);

  // Nachricht hinzufügen (wird in Composer & TipModal verwendet)
  const addMessage = React.useCallback(
    (text: string) => {
      if (!convo) return;
      const m: ChatMessage = {
        id: `loc-${Date.now()}`,
        convoId: convo.id,
        senderId: me.id,
        text,
        createdAt: new Date().toISOString(),
        seen: false,
      };
      setMessages((prev) => [...prev, m]);
    },
    [convo, me.id]
  );

  // Falls Konversation nicht existiert
  if (!convo || !other) {
    return (
      <main className="mx-auto px-3 py-6" style={{ maxWidth: 760 }}>
        Conversation not found.
      </main>
    );
  }

  return (
    <>
      <ChatHeader other={other} />

      <main
        className="mx-auto px-3"
        style={{
          maxWidth: 760,
          paddingTop: 'calc(var(--chat-header-h, var(--header-h, 56px)) + 8px)',
          paddingBottom: 'calc(var(--bottomnav-h, 72px) + 72px)',
        }}
      >
        <div className="space-y-2 pb-24">
          {messages.map((m) => {
            const mine = m.senderId === me.id;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 border ${
                    mine
                      ? 'bg-[var(--purple)]/90 border-[var(--purple)]/40 text-white'
                      : 'bg-white/[.07] border-white/10'
                  }`}
                >
                  {m.text && <div className="whitespace-pre-wrap">{m.text}</div>}
                  <div className="text-[11px] text-white/70 mt-1 opacity-80">
                    {new Date(m.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <ChatComposer
        disabled={!other.dmOpen && me.role === 'submissive'}
        onSend={addMessage}
        onTip={() => setTipOpen(true)}
        onUpload={(file) => addMessage(`📎 Uploaded: ${file.name}`)}
      />

      <TipModal
        open={tipOpen}
        onClose={() => setTipOpen(false)}
        onConfirm={(cents) => addMessage(`💜 Sent tip: $${(cents / 100).toFixed(2)}`)}
        receipient={{ name: other.displayName, role: other.role, avatarUrl: other.avatarUrl }}
      />
    </>
  );
}
