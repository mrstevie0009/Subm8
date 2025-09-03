'use client';
import * as React from 'react';
import MentionSuggestChat from '@/components/MentionSuggestChat';

type Props = {
  disabled?: boolean;
  disabledNotice?: string;
  onSend: (text: string) => void;
  onTip: () => void;
  onUpload?: (file: File) => void;
};

export default function ChatComposer({ disabled, disabledNotice, onSend, onTip, onUpload }: Props) {
  const [text, setText] = React.useState('');
  const taRef = React.useRef<HTMLTextAreaElement | null>(null);

  // ⬇️ Anker für Mention-Panel
  const suggestAnchorRef = React.useRef<HTMLDivElement>(null);

  const maxRows = 6;
  const lineH = 20;
  const padY  = 12;
  const maxHeight = maxRows * lineH + padY;

  const autosize = React.useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
  }, [maxHeight]);

  React.useEffect(() => { autosize(); }, [text, autosize]);

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

  return (
    <div
      className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40 w-[min(100vw,760px)]
                 border-t border-sub bg-black/60 backdrop-blur supports-[backdrop-filter]:bg-black/45
                 px-3 pb-2 pt-2"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}
    >
      {disabled && disabledNotice && (
        <div className="mb-2 text-center text-[13px] text-white/80">
          {disabledNotice} Diese Konversation wurde Blockiert.
        </div>
      )}

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

      {/* Mentions (Portal, fixed, immer sichtbar über dem Footer) */}
      <MentionSuggestChat
        anchorRef={suggestAnchorRef as React.RefObject<HTMLElement>}
        value={text}
        onChange={setText}
        limit={8}
      />
    </div>
  );
}

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
