'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import MentionSuggestChat from '@/components/MentionSuggestChat';
import TipRequestCreateModal from '@/components/TipRequestCreateModal';
import OwnershipRequestCreateModal, {
  type OwnershipReqPayload as OwnReqPayload,
} from '@/components/OwnershipRequestCreateModal';

type RoleLike = 'domme' | 'submissive' | 'DOMME' | 'SUBMISSIVE';
type TipRequestPayload = { amountCents: number; note?: string; currency?: string };

type Props = {
  disabled?: boolean;
  disabledNotice?: string;
  viewerRole: RoleLike;
  /** eigene User-ID des Viewers (für Ownership-Draft LocalStorage) */
  selfUserId: string;
  /** Anzeige im Ownership-Modal (@handle des Subs) */
  targetHandle: string;
  onSend: (text: string) => void;
  onTip: () => void;
  onUpload?: (file: File) => void;
  onCreateTipRequest?: (payload: TipRequestPayload) => void;
};

/* ---------- kleines Popover/ActionMenu via Portal ---------- */
function ActionMenu({
  anchorRect,
  onClose,
  children,
}: {
  anchorRect: DOMRect;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null);

  const recompute = React.useCallback(() => {
    const gap = 8;
    const margin = 8;
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const width = Math.max(220, Math.min(320, anchorRect.width));

    let left = Math.round(anchorRect.left);
    left = Math.min(Math.max(margin, left), winW - width - margin);

    const spaceAbove = Math.max(0, anchorRect.top - margin);
    const spaceBelow = Math.max(0, winH - anchorRect.bottom - margin);
    let openUp = spaceAbove > spaceBelow;

    let top = openUp ? Math.round(anchorRect.top - gap) : Math.round(anchorRect.bottom + gap);

    const h = panelRef.current?.offsetHeight ?? 0;
    if (h > 0) {
      if (openUp && top - h < margin) {
        openUp = false;
        top = Math.round(anchorRect.bottom + gap);
      }
      if (!openUp && top + h > winH - margin) {
        if (spaceAbove >= h + gap) {
          openUp = true;
          top = Math.round(anchorRect.top - gap);
        } else {
          top = Math.max(margin, winH - margin - h);
        }
      }
    }

    setPos({ top, left, width, openUp });
  }, [anchorRect]);

  React.useLayoutEffect(() => {
    recompute();
  }, [recompute]);

  React.useEffect(() => {
    const onOutside = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (panelRef.current && t && panelRef.current.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('pointerdown', onOutside, { passive: true });
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', onOutside);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute);
    };
  }, [onClose, recompute]);

  if (!pos) return null;

  const style: React.CSSProperties = {
    position: 'fixed',
    left: pos.left,
    top: pos.top,
    width: pos.width,
    transform: pos.openUp ? 'translateY(-100%)' : undefined,
    zIndex: 2147483601,
  };

  const panel = (
    <div style={style}>
      <div ref={panelRef} className="rounded-xl border border-white/12 bg-black/90 backdrop-blur p-1 shadow-2xl">
        {children}
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}

/* ------------------ Composer ------------------ */
export default function ChatComposer({
  disabled,
  disabledNotice,
  viewerRole,
  selfUserId,
  targetHandle,
  onSend,
  onTip,
  onUpload,
  onCreateTipRequest,
}: Props) {
  const [text, setText] = React.useState('');
  const taRef = React.useRef<HTMLTextAreaElement | null>(null);

  const suggestAnchorRef = React.useRef<HTMLDivElement>(null);

  const maxRows = 6;
  const lineH = 20;
  const padY = 12;
  const maxHeight = maxRows * lineH + padY;

  const autosize = React.useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
  }, [maxHeight]);

  React.useEffect(() => {
    autosize();
  }, [text, autosize]);

  const submit = React.useCallback(() => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText('');
    requestAnimationFrame(() => autosize());
  }, [text, disabled, onSend, autosize]);

  const circle = 'grid place-items-center rounded-full select-none';
  const sendSize = 40;
  const toolSize = 40;

  const isSub = String(viewerRole).toUpperCase() === 'SUBMISSIVE';

  // Plus-Menu (nur für Dommes)
  const plusBtnRef = React.useRef<HTMLButtonElement | null>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [anchorRect, setAnchorRect] = React.useState<DOMRect | null>(null);

  const openMenu = React.useCallback(() => {
    const r = plusBtnRef.current?.getBoundingClientRect();
    if (!r) return;
    setAnchorRect(r);
    setMenuOpen(true);
  }, []);

  // Modals
  const [tipReqOpen, setTipReqOpen] = React.useState(false);
  const [ownReqOpen, setOwnReqOpen] = React.useState(false);

  return (
    <div
      className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-[min(100vw,760px)]
                 border-t border-sub bg-black/60 backdrop-blur supports-[backdrop-filter]:bg-black/45
                 px-3 pb-2 pt-2"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}
    >
      {disabled && disabledNotice && <div className="mb-2 text-center text-[13px] text-white/80">{disabledNotice} Diese Konversation wurde Blockiert.</div>}

      <div className="rounded-3xl border border-white/10 bg-white/[.06] shadow-[0_2px_16px_rgba(0,0,0,.25)] px-3 py-2">
        <div ref={suggestAnchorRef} className="grid grid-cols-[1fr_auto] items-end gap-2">
          <div className="flex flex-col">
            <textarea
              ref={taRef}
              rows={1}
              value={text}
              disabled={disabled}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={disabled ? 'DMs geschlossen' : 'Message…'}
              className="w-full resize-none bg-transparent outline-none placeholder:text-muted
                         text-[14px] leading-5 px-3 pt-1 pb-1 rounded-2xl"
              style={{ minHeight: 40, overflow: 'hidden' }}
            />

            <div className="mt-2 flex items-center gap-8 pl-2">
              <label
                className={`${circle} border border-white/12 bg-transparent hover:bg-white/10 cursor-pointer`}
                style={{ width: toolSize, height: toolSize }}
                aria-label="Upload media"
                title="Upload media"
              >
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,video/*"
                  disabled={disabled}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && onUpload) onUpload(f);
                    e.currentTarget.value = '';
                  }}
                />
                <PhotoIcon />
              </label>

              {isSub ? (
                <button
                  type="button"
                  onClick={onTip}
                  disabled={disabled}
                  className={`${circle} border border-white/12 bg-transparent hover:bg-white/10 disabled:opacity-50`}
                  style={{ width: toolSize, height: toolSize }}
                  aria-label="Send tip"
                  title="Send tip"
                >
                  <DollarIcon />
                </button>
              ) : (
                <>
                  <button
                    ref={plusBtnRef}
                    type="button"
                    onClick={() => (disabled ? null : openMenu())}
                    disabled={disabled}
                    className={`${circle} border border-white/12 bg-transparent hover:bg-white/10 disabled:opacity-50`}
                    style={{ width: toolSize, height: toolSize }}
                    aria-label="Open actions"
                    title="Actions"
                  >
                    <PlusIcon />
                  </button>

                  {menuOpen && anchorRect && (
                    <ActionMenu anchorRect={anchorRect} onClose={() => setMenuOpen(false)}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10"
                        onClick={() => {
                          setMenuOpen(false);
                          setTipReqOpen(true);
                        }}
                      >
                        Tip request
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10"
                        onClick={() => setMenuOpen(false)}
                      >
                        Autodrain request
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10"
                        onClick={() => {
                          setMenuOpen(false);
                          setOwnReqOpen(true);
                        }}
                      >
                        Ownership request
                      </button>
                    </ActionMenu>
                  )}
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={!text.trim() || disabled}
            className={`${circle} bg-[var(--purple)] text-white hover:opacity-95 disabled:opacity-50`}
            style={{ width: sendSize, height: sendSize }}
            aria-label="Send message"
            title="Send"
          >
            <SendIcon />
          </button>
        </div>
      </div>

      <MentionSuggestChat anchorRef={suggestAnchorRef as React.RefObject<HTMLElement>} value={text} onChange={setText} limit={8} />

      <TipRequestCreateModal
        open={tipReqOpen}
        onClose={() => setTipReqOpen(false)}
        onCreate={(payload) => {
          setTipReqOpen(false);
          if (onCreateTipRequest) {
            onCreateTipRequest(payload);
            return;
          }
          const currency = payload.currency ?? 'EUR';
          const amountStr = new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(payload.amountCents / 100);
          const msg = `🧾 Tip request: ${amountStr}${payload.note ? `\n${payload.note}` : ''}`;
          onSend(msg);
        }}
      />

      <OwnershipRequestCreateModal
        open={ownReqOpen}
        onClose={() => setOwnReqOpen(false)}
        userId={selfUserId}
        handle={targetHandle}
        onCreate={(payload: OwnReqPayload) => {
          setOwnReqOpen(false);
          onSend(`OWNREQ::${JSON.stringify(payload)}`);
        }}
      />
    </div>
  );
}

/* --------- Icons --------- */
function SendIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className="drop-shadow-[0_1px_2px_rgba(0,0,0,.35)]">
      <path d="M21.7 3.4c.7-.27 1.4.4 1.13 1.12l-6.9 18a1 1 0 0 1-1.85-.06l-2.15-6.13-6.13-2.15A1 1 0 0 1 5.64 12l18-6.9Z" fill="currentColor" />
      <path d="M11.8 14.3 21.1 5M9.4 11.9l11.3-4.2" fill="none" stroke="#000" strokeOpacity=".22" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PhotoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="M8 12.5l2.5-2.5 4.5 5 2.5-2.5" />
      <circle cx="9" cy="9.5" r="1.2" />
    </svg>
  );
}
function DollarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 2.5v19" strokeLinecap="round" />
      <path d="M16.5 7.5c0-2-2-3.5-4.5-3.5S7.5 5.5 7.5 7.5 9.6 10 12 10s4.5 1 4.5 3.5S14 17 12 17s-4.5-1-4.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}
