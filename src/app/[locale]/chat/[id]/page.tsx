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
    role: DbRole;
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

// UI-Message-Typ: erweitert ChatMessage um optionale Media-Felder
type UiMessage = ChatMessage & {
  mediaUrl?: string;
  mediaType?: string;
};

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

  const [messages, setMessages] = React.useState<UiMessage[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [tipOpen, setTipOpen] = React.useState(false);

  const mapRole = React.useCallback(
    (r: DbRole): 'domme' | 'submissive' => (r === 'DOMME' ? 'domme' : 'submissive'),
    []
  );

  const load = React.useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`/api/chat/${id}`, { cache: 'no-store' });
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        const txt = await res.text().catch(() => '');
        throw new Error(
          `Unexpected response (${res.status}). ${txt ? txt.slice(0, 140) : 'Empty body'}`
        );
      }

      const json: ThreadResponse = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to load');

      setMeId(json.me.id);

      setOther({
        id: json.other.id,
        username: json.other.handle,
        displayName: json.other.displayName,
        avatarUrl: json.other.avatarUrl ?? undefined,
        role: mapRole(json.other.role),
        dmOpen: true,
      });

      const mapped: UiMessage[] = json.messages.map((m) => ({
        id: m.id,
        convoId: String(id),
        senderId: m.authorId,
        text: m.text ?? (m.mediaUrl ? '' : ''),
        createdAt: m.at,
        seen: m.read,
        mediaUrl: m.mediaUrl ?? undefined,
        mediaType: m.mediaType ?? undefined,
      }));
      setMessages(mapped);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id, mapRole]);

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

  // Server-Call: akzeptiert { text, file? }
  const sendMessage = React.useCallback(
    async ({ text, file }: { text: string; file?: File }) => {
      if (file) {
        const fd = new FormData();
        fd.append('text', text);
        fd.append('file', file);
        await fetch(`/api/chat/${id}`, { method: 'POST', body: fd });
      } else {
        await fetch(`/api/chat/${id}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text }),
        });
      }
      await load();
    },
    [id, load]
  );

  if (!loading && error) {
    return (
      <main className="mx-auto px-3 py-6" style={{ maxWidth: 760 }}>
        {error}
      </main>
    );
  }

  return (
    <>
      {other && (
        <ChatHeader
          other={{
            id: other.id,
            username: other.username,
            displayName: other.displayName,
            avatarUrl: other.avatarUrl,
            role: other.role,
            dmOpen: other.dmOpen,
          }}
        />
      )}

      <main className="px-3">
        <div
          className="mx-auto w-full max-w-[760px]"
          style={{
            paddingTop: 'calc(var(--header-h, 56px) + var(--chat-header-h, 48px) + 8px)',
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
                      className={`max-w-[75%] rounded-2xl px-3 py-2 border break-words
                                  ${
                                    mine
                                      ? 'bg-[var(--purple)]/90 border-[var(--purple)]/40 text-white'
                                      : 'bg-white/[.07] border-white/10'
                                  }`}
                      title={new Date(m.createdAt).toLocaleString()}
                    >
                      {/* Media zuerst */}
                      {m.mediaUrl && (
                        <div className="mb-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={m.mediaUrl}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="block max-w-full h-auto max-h-[60vh] rounded-lg border border-white/10 object-contain"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      {m.text && (
                        <div className="whitespace-pre-wrap break-words">{m.text}</div>
                      )}
                      <div
                        className={`text-[11px] mt-1 opacity-80 ${
                          mine ? 'text-white/80' : 'text-white/70'
                        }`}
                      >
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

      {/* ChatComposer erwartet onSend: (text: string) => void */}
      <ChatComposer
        disabled={false}
        onSend={(text) => sendMessage({ text })}
        onTip={() => setTipOpen(true)}
        onUpload={(file) => sendMessage({ text: '', file })}
      />

      {other && (
        <TipModal
          open={tipOpen}
          onClose={() => setTipOpen(false)}
          toUserId={other.id}
          toDisplayName={other.displayName}
          toRole={other.role}
          toAvatarUrl={other.avatarUrl}
          conversationId={String(id)}
          onSuccess={({ amountCents, currency, note }) => {
            const amountStr = new Intl.NumberFormat(undefined, {
              style: 'currency',
              currency,
            }).format(amountCents / 100); // Netto an die Domme
            const lines = [`💜 Sent tip: ${amountStr}`];
            if (note) lines.push(note);
            void sendMessage({ text: lines.join('\n') });
            setTipOpen(false);
          }}
        />
      )}
    </>
  );
}
