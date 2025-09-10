'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import ChatHeader from '@/components/ChatHeader';
import ChatComposer from '@/components/ChatComposer';
import TipModal from '@/components/TipModal';
import TipRequestAcceptModal from '@/components/TipRequestAcceptModal';
import OwnershipRequestAcceptModal from '@/components/OwnershipRequestAcceptModal';
import type { OwnershipReqPayload as AcceptOwnReqPayload } from '@/components/OwnershipRequestAcceptModal';
import type { ChatMessage } from '@/types/chat';
import RichText from '@/components/RichText';

type DbRole = 'DOMME' | 'SUBMISSIVE';

type ThreadOk = {
  ok: true;
  me: { id: string; role: DbRole };
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
  viewerHasBlocked: boolean;
  isBlockedByOther: boolean;
};
type ThreadErr = { ok: false; error: string };
type ThreadResponse = ThreadOk | ThreadErr;

type UiMessage = ChatMessage & {
  mediaUrl?: string;
  mediaType?: string;
};

/* ------------ Envelope helpers ------------ */
// TIP REQUEST
const TIPREQ_PREFIX = 'TIPREQ::';
type TipRequestPayload = { id?: string; amountCents: number; currency: string; note?: string };
function parseTipRequest(text?: string | null): TipRequestPayload | null {
  if (!text || !text.startsWith(TIPREQ_PREFIX)) return null;
  try {
    const obj = JSON.parse(text.slice(TIPREQ_PREFIX.length));
    if (typeof obj?.amountCents === 'number' && obj?.currency) return obj as TipRequestPayload;
  } catch {}
  return null;
}

// TIP PAID
const TIPPAID_PREFIX = 'TIPPAID::';
type TipPaidPayload = { id?: string; amountCents: number; currency: string; note?: string };
function parseTipPaid(text?: string | null): TipPaidPayload | null {
  if (!text || !text.startsWith(TIPPAID_PREFIX)) return null;
  try {
    const obj = JSON.parse(text.slice(TIPPAID_PREFIX.length));
    if (typeof obj?.amountCents === 'number' && obj?.currency) return obj as TipPaidPayload;
  } catch {}
  return null;
}

// OWNERSHIP REQUEST / ACCEPTED
const OWNREQ_PREFIX = 'OWNREQ::';
const OWNACC_PREFIX = 'OWNACC::';

/** exakt wie im OwnershipRequestAcceptModal: neue Referenzen + Legacy-DataURLs */
type OwnershipReqPayload = AcceptOwnReqPayload;

function parseOwnReq(text?: string | null): OwnershipReqPayload | null {
  if (!text || !text.startsWith(OWNREQ_PREFIX)) return null;
  try {
    const obj = JSON.parse(text.slice(OWNREQ_PREFIX.length)) as OwnershipReqPayload;
    if (obj && typeof obj === 'object') return obj;
  } catch {}
  return null;
}
function parseOwnAcc(text?: string | null): { ok: true } | null {
  if (!text || !text.startsWith(OWNACC_PREFIX)) return null;
  return { ok: true };
}

/* ---- Type Guards um `any` zu vermeiden ---- */
type LegacyDataUrls = { avatarDataUrl?: string; bannerDataUrl?: string; bio?: string };
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
function isLegacyDataUrls(p: OwnershipReqPayload): p is LegacyDataUrls {
  if (!isRecord(p)) return false;
  return (
    typeof p['avatarDataUrl'] === 'string' ||
    typeof p['bannerDataUrl'] === 'string' ||
    typeof p['bio'] === 'string'
  );
}

function fmtCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format((cents || 0) / 100);
}

export default function ChatThreadPage() {
  const { id } = useParams<{ id: string }>();
  const locale = useLocale();

  const [meId, setMeId] = React.useState<string | null>(null);
  const [meRole, setMeRole] = React.useState<'domme' | 'submissive' | null>(null);

  const [other, setOther] = React.useState<{
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    role: 'domme' | 'submissive';
    dmOpen: boolean;
  } | null>(null);

  const [viewerHasBlocked, setViewerHasBlocked] = React.useState(false);
  const [isBlockedByOther, setIsBlockedByOther] = React.useState(false);

  const [messages, setMessages] = React.useState<UiMessage[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [tipOpen, setTipOpen] = React.useState(false);

  // Accept-modal state for tip requests (SUB)
  const [accept, setAccept] = React.useState<{
    amountCents: number;
    currency: string;
    toUserId: string;
    toDisplayName: string;
    toAvatarUrl?: string;
  } | null>(null);

  // Accept-modal state for ownership requests (SUB)
  const [ownToAccept, setOwnToAccept] = React.useState<OwnershipReqPayload | null>(null);

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
        throw new Error(`Unexpected response (${res.status}). ${txt ? txt.slice(0, 140) : 'Empty body'}`);
      }

      const json: ThreadResponse = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to load');

      setMeId(json.me.id);
      setMeRole(mapRole(json.me.role));

      setViewerHasBlocked(json.viewerHasBlocked ?? false);
      setIsBlockedByOther(json.isBlockedByOther ?? false);

      const disabled = (json.viewerHasBlocked ?? false) || (json.isBlockedByOther ?? false);

      setOther({
        id: json.other.id,
        username: json.other.handle,
        displayName: json.other.displayName,
        avatarUrl: json.other.avatarUrl ?? undefined,
        role: mapRole(json.other.role),
        dmOpen: !disabled,
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

  const sendMessage = React.useCallback(
    async ({ text, file }: { text: string; file?: File }) => {
      if (viewerHasBlocked || isBlockedByOther) return;

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
    [id, load, viewerHasBlocked, isBlockedByOther]
  );

  const disabled = viewerHasBlocked || isBlockedByOther;
  const disabledNotice = disabled
    ? isBlockedByOther
      ? 'Du kannst dieser Person keine Direktnachrichten mehr senden.'
      : 'Du hast diese Person blockiert. Senden ist deaktiviert.'
    : undefined;

  if (!loading && error) {
    return (
      <main className="mx-auto px-3 py-6" style={{ maxWidth: 760 }}>
        {error}
      </main>
    );
  }

  // Hilfsfunktion: Video erkennen (mediaType oder Dateiendung)
  const isVideo = (url?: string, mime?: string) =>
    (mime ?? '').startsWith('video/') || (url ? /\.(mp4|webm|ogg|mov)$/i.test(url) : false);

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
          viewerHasBlocked={viewerHasBlocked}
          isBlockedByOther={isBlockedByOther}
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

                // TIP REQUEST
                const req = parseTipRequest(m.text);
                if (req) {
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[75%] rounded-2xl px-3 py-2 border bg-white/[.07] border-white/10">
                        <div className="text-[11px] uppercase tracking-wide text-white/70 mb-1">TIP REQUEST</div>
                        <div className="text-[15px] font-semibold">{fmtCurrency(req.amountCents, req.currency)}</div>
                        {req.note && <div className="mt-1 text-[13px] text-white/80 whitespace-pre-wrap">{req.note}</div>}
                        {(!mine || true) && (
                          <div className="text-[11px] mt-2 text-white/60" title={new Date(m.createdAt).toLocaleString()}>
                            {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // TIP PAID
                const paid = parseTipPaid(m.text);
                if (paid) {
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[75%] rounded-2xl px-3 py-2 border bg-white/[.07] border-white/10">
                        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-white/70 mb-1">
                          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="9" />
                            <path d="M8.5 12.5l2.5 2.5 4.5-5" />
                          </svg>
                          <span>TIP PAID</span>
                          {paid.id && <span className="text-white/50 normal-case ml-1">#{paid.id.slice(0, 6)}</span>}
                        </div>
                        <div className="text-[15px] font-semibold">{fmtCurrency(paid.amountCents, paid.currency)}</div>
                        {paid.note && <div className="mt-1 text-[13px] text-white/80 whitespace-pre-wrap">{paid.note}</div>}
                        <div className="text-[11px] mt-2 text-white/60" title={new Date(m.createdAt).toLocaleString()}>
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                }

                // OWNERSHIP REQUEST
                const ownReq = parseOwnReq(m.text);
                if (ownReq) {
                  const canAct = !mine && meRole === 'submissive';

                  const hasAvatar = Boolean(ownReq.avatar || (isLegacyDataUrls(ownReq) && ownReq.avatarDataUrl));
                  const hasBanner = Boolean(ownReq.banner || (isLegacyDataUrls(ownReq) && ownReq.bannerDataUrl));
                  const hasBio =
                    typeof ownReq.bio === 'string' ? ownReq.bio.trim().length > 0 : Boolean(ownReq.bio);

                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[75%] rounded-2xl px-3 py-2 border bg-white/[.07] border-white/10">
                        <div className="text-[11px] uppercase tracking-wide text-white/70 mb-1">OWNERSHIP REQUEST</div>

                        <ul className="text-[13px] text-white/80 space-y-1 mb-2">
                          {hasAvatar && <li>• Avatar</li>}
                          {hasBanner && <li>• Banner</li>}
                          {hasBio && <li>• Bio</li>}
                        </ul>

                        {canAct && (
                          <div className="mt-1 flex items-center gap-2">
                            <button
                              type="button"
                              className="px-3 py-1.5 rounded-lg bg-[var(--purple)]/90 text-white hover:opacity-95"
                              onClick={() => setOwnToAccept(ownReq)}
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              className="px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/10"
                              onClick={() => void sendMessage({ text: '❌ Declined ownership request' })}
                            >
                              Decline
                            </button>
                          </div>
                        )}

                        <div className="text-[11px] mt-2 text-white/60" title={new Date(m.createdAt).toLocaleString()}>
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                }

                // OWNERSHIP ACCEPTED
                const ownAcc = parseOwnAcc(m.text);
                if (ownAcc) {
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[75%] rounded-2xl px-3 py-2 border bg-white/[.07] border-white/10">
                        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-white/70 mb-1">
                          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="9" />
                            <path d="M8.5 12.5l2.5 2.5 4.5-5" />
                          </svg>
                          <span>OWNERSHIP ACCEPTED</span>
                        </div>
                        <div className="text-[13px] text-white/80">Changes were applied to the sub’s profile.</div>
                        <div className="text-[11px] mt-2 text-white/60" title={new Date(m.createdAt).toLocaleString()}>
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                }

                // -------- Default: normal message / media message ----------
                const mineBubble =
                  mine ? 'bg-[var(--purple)]/90 border-[var(--purple)]/40 text-white' : 'bg-white/[.07] border-white/10';

                const showVideo = isVideo(m.mediaUrl, m.mediaType);
                const hasMedia = Boolean(m.mediaUrl);

                // Medien-Only (oder Medien + Text): KEINE Bubble um das Medium
                if (hasMedia) {
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[75%]">
                        <div className="mb-1">
                          {showVideo ? (
                            <video
                              src={m.mediaUrl}
                              controls
                              playsInline
                              className="block max-w-full h-auto max-h-[60vh] rounded-2xl border border-white/10 object-contain"
                            />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={m.mediaUrl}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              className="block max-w-full h-auto max-h-[60vh] rounded-2xl border border-white/10 object-contain"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          )}
                        </div>

                        {/* Falls Text vorhanden: nur der Text bekommt eine Bubble */}
                        {m.text && m.text.trim().length > 0 && (
                          <div className={`mt-2 rounded-2xl px-3 py-2 border break-words ${mineBubble}`}>
                            <RichText
                              text={m.text}
                              locale={locale}
                              validateMentions
                              className="break-words"
                              variant={mine ? 'chat' : 'default'}
                            />
                          </div>
                        )}

                        <div
                          className={`text-[11px] mt-1 opacity-80 ${mine ? 'text-white/80 text-right' : 'text-white/70'}`}
                          title={new Date(m.createdAt).toLocaleString()}
                        >
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                }

                // Nur Text: normale Bubble
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-3 py-2 border break-words ${mineBubble}`}
                      title={new Date(m.createdAt).toLocaleString()}
                    >
                      {m.text && (
                        <RichText
                          text={m.text}
                          locale={locale}
                          validateMentions
                          className="break-words"
                          variant={mine ? 'chat' : 'default'}
                        />
                      )}
                      <div className={`text-[11px] mt-1 opacity-80 ${mine ? 'text-white/80' : 'text-white/70'}`}>
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Composer */}
      <ChatComposer
        viewerRole={meRole ?? 'submissive'}
        disabled={disabled}
        disabledNotice={disabledNotice}
        selfUserId={meId ?? ''}                // ⬅️ richtige eigene User-ID
        targetHandle={other?.username ?? ''}   // nur Anzeige im Modal
        onSend={(text) => sendMessage({ text })}
        onTip={() => setTipOpen(true)}
        onUpload={(file) => sendMessage({ text: '', file })}
        onCreateTipRequest={(p: { amountCents: number; currency?: string; note?: string }) => {
          const { amountCents, currency = 'EUR', note } = p;
          const payload = { amountCents, currency, note: note?.trim() || undefined };
          void sendMessage({ text: `TIPREQ::${JSON.stringify(payload)}` });
        }}
      />

      {/* Tip (voluntary) */}
      {other && (
        <TipModal
          open={tipOpen}
          onClose={() => setTipOpen(false)}
          toUserId={other.id}
          toDisplayName={other.displayName}
          toRole={other.role}
          toAvatarUrl={other.avatarUrl}
          conversationId={String(id)}
          onSuccess={({ paymentId, amountCents, currency, note }) => {
            const payload: TipPaidPayload = { id: paymentId, amountCents, currency, note: note?.trim() || undefined };
            void sendMessage({ text: `${TIPPAID_PREFIX}${JSON.stringify(payload)}` });
            setTipOpen(false);
          }}
        />
      )}

      {/* Accept a Tip Request (SUB) */}
      {accept && other && (
        <TipRequestAcceptModal
          open={!!accept}
          onClose={() => setAccept(null)}
          amountCents={accept.amountCents}
          currency={accept.currency}
          toUserId={accept.toUserId}
          toDisplayName={accept.toDisplayName}
          toAvatarUrl={accept.toAvatarUrl}
          conversationId={String(id)}
          onSuccess={({ amountCents, currency, paymentId }) => {
            const payload: TipPaidPayload = { id: paymentId, amountCents, currency };
            void sendMessage({ text: `${TIPPAID_PREFIX}${JSON.stringify(payload)}` });
            setAccept(null);
          }}
        />
      )}

      {/* Accept an Ownership Request (SUB) */}
      {ownToAccept && (
        <OwnershipRequestAcceptModal
          open={!!ownToAccept}
          onClose={() => setOwnToAccept(null)}
          payload={ownToAccept}
          selfUserId={meId ?? undefined}
          onSuccess={async () => {
            await sendMessage({ text: `${OWNACC_PREFIX}{}` });
            setOwnToAccept(null);
            await load();
          }}
        />
      )}
    </>
  );
}
