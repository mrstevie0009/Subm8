// src/app/[locale]/chat/[id]/page.tsx
'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import ChatHeader from '@/components/ChatHeader';
import ChatComposer from '@/components/ChatComposer';
import TipModal from '@/components/TipModal';
import type { ChatMessage } from '@/types/chat';

type DbRole = 'DOMME' | 'SUBMISSIVE';

type ThreadOk = {
  ok: true;
  me: { id: string };
  other: {
    id: string;
    handle: string;
    displayName: string;
    avatarUrl: string | null;
    role: DbRole; // <-- Rolle kommt direkt aus der DB
  };
  messages: {
    id: string;
    at: string;
    authorId: string;
    text?: string | null;
    mediaUrl?: string | null;
    mediaType?: string | null;
    read: boolean;
  }[];
};
type ThreadErr = { ok: false; error: string };
type ThreadResponse = ThreadOk | ThreadErr;

export default function ChatThreadPage() {
  const { id } = useParams<{ id: string }>();

  const [meId, setMeId] = React.useState<string | null>(null);
  const [other, setOther] = React.useState<{
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    role: 'domme' | 'submissive';
    dmOpen: boolean;
  } | null>(null);

  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [tipOpen, setTipOpen] = React.useState(false);

  const mapRole = (r: DbRole): 'domme' | 'submissive' =>
    r === 'DOMME' ? 'domme' : 'submissive';

  const load = React.useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`/api/chat/${id}`, { cache: 'no-store' });
      const json: ThreadResponse = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to load');

      setMeId(json.me.id);

      setOther({
        id: json.other.id,
        username: json.other.handle,
        displayName: json.other.displayName,
        avatarUrl: json.other.avatarUrl ?? undefined,
        role: mapRole(json.other.role), // ✅ echte Rolle verwenden
        dmOpen: true,
      });

      const mapped: ChatMessage[] = json.messages.map((m) => ({
        id: m.id,
        convoId: String(id),
        senderId: m.authorId,
        text: m.text ?? (m.mediaUrl ? '[Media]' : ''),
        createdAt: m.at,
        seen: m.read,
      }));
      setMessages(mapped);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Initial laden + leichtes Polling
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await load();
    })();
    const t = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [load]);

  // Nachricht senden
  const sendMessage = React.useCallback(
    async (text: string) => {
      await fetch(`/api/chat/${id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      await load();
    },
    [id, load]
  );

  // Datei-Upload (Platzhalter)
  const handleUpload = React.useCallback((file: File) => {
    alert(`Upload kommt bald: ${file.name}`);
  }, []);

  if (!loading && error) {
    return (
      <main className="mx-auto px-3 py-6" style={{ maxWidth: 760 }}>
        {error}
      </main>
    );
  }

  return (
    <>
      {/* Header mit Gegenüber (zentriert, Label nutzt echte Rolle) */}
      {other && (
        <ChatHeader
          other={{
            id: other.id,
            username: other.username,
            displayName: other.displayName,
            avatarUrl: other.avatarUrl,
            role: other.role, // 'domme' | 'submissive'
            dmOpen: other.dmOpen,
          }}
        />
      )}

      {/* Hauptbereich: zentriert unter globalem Header + ChatHeader */}
      <main className="px-3">
        <div
          className="mx-auto w-full max-w-[760px]"
          style={{
            paddingTop:
              'calc(var(--header-h, 56px) + var(--chat-header-h, 48px) + 8px)',
            paddingBottom: 'calc(var(--bottomnav-h, 72px) + 72px)',
          }}
        >
          {loading ? (
            <div className="py-8 text-sm text-muted">Loading…</div>
          ) : (
            <div className="space-y-2 pb-24">
              {messages.map((m) => {
                const mine = meId ? m.senderId === meId : false;
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-3 py-2 border ${
                        mine
                          ? 'bg-[var(--purple)]/90 border-[var(--purple)]/40 text-white'
                          : 'bg-white/[.07] border-white/10'
                      }`}
                      title={new Date(m.createdAt).toLocaleString()}
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
          )}
        </div>
      </main>

      <ChatComposer
        disabled={false /* später via dmOpen/meRole steuerbar */}
        onSend={sendMessage}
        onTip={() => setTipOpen(true)}
        onUpload={handleUpload}
      />

      <TipModal
        open={tipOpen}
        onClose={() => setTipOpen(false)}
        onConfirm={(cents) => sendMessage(`💜 Sent tip: $${(cents / 100).toFixed(2)}`)}
        receipient={{
          name: other?.displayName ?? '—',
          role: other?.role ?? 'submissive',
          avatarUrl: other?.avatarUrl ?? undefined,
        }}
      />
    </>
  );
}
