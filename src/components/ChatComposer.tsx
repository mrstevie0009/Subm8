'use client';
import * as React from 'react';

type Props = {
  disabled?: boolean;                    // z.B. wenn DM nicht geöffnet
  onSend: (text: string) => void;
  onTip: () => void;
  onUpload?: (file: File) => void;
};

export default function ChatComposer({ disabled, onSend, onTip, onUpload }: Props) {
  const [text, setText] = React.useState('');

  const submit = React.useCallback(() => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  }, [text, onSend]);

  // Große, responsive Buttonfläche (mindestens 44px)
  const btnSize = 'clamp(44px, 6.5vw, 52px)';

  return (
    <div
      className="fixed bottom-0 left-1/2 -translate-x-1/2 z-40
                 w-[min(100vw,760px)]
                 bg-black/60 backdrop-blur supports-[backdrop-filter]:bg-black/45
                 border-t border-sub px-3 py-2"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-end gap-2">
        {/* LEFT: große Buttons (Upload + Tip) */}
        <div className="flex items-center gap-2 mr-1">
          {/* Upload */}
          <label
            className="shrink-0 inline-grid place-items-center rounded-xl border border-white/12 bg-white/6 hover:bg-white/10 cursor-pointer disabled:opacity-50"
            style={{ width: btnSize, height: btnSize }}
            aria-label="Upload media"
          >
            <input
              type="file"
              className="hidden"
              accept="image/*,video/*"
              disabled={disabled}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && onUpload) onUpload(f);
                e.currentTarget.value = ''; // reset (gleiches File erneut möglich)
              }}
            />
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 strokeWidth="2" className="opacity-90"
                 style={{ width: '58%', height: '58%' }} aria-hidden="true">
              <path d="M12 5v9m0 0-3-3m3 3 3-3M5 19h14" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </label>

          {/* Tip */}
          <button
            type="button"
            onClick={onTip}
            disabled={disabled}
            className="shrink-0 inline-grid place-items-center rounded-xl disabled:opacity-50 focus-visible:outline focus-visible:outline-[var(--purple)]/60"
            style={{ width: btnSize, height: btnSize }}
            aria-label="Send tip"
            title="Send tip"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                 aria-hidden="true"
                 style={{ width: '62%', height: '62%', color: 'var(--purple)' }}>
              <path d="M12 2.2v3.2M12 18.6v3.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M17 7c0-2.1-2.2-3.6-5-3.6S7 4.9 7 7s2.3 3.2 5 3.2 5 1.2 5 3.6S14.8 17.6 12 17.6 7 16.4 7 13.8"
                    fill="none" stroke="currentColor" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* MIDDLE: Message-Feld */}
        <div className="flex-1">
          <textarea
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
            placeholder={disabled ? 'DMs closed' : 'Message…'}
            className="w-full resize-none rounded-2xl border border-white/10 bg-white/[.06] px-3 py-2 outline-none placeholder:text-muted"
            style={{ minHeight: '44px' }}
          />
        </div>

        {/* RIGHT: Senden */}
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim() || disabled}
          className="shrink-0 px-4 py-2 rounded-xl bg-[var(--purple)] text-white hover:opacity-95 disabled:opacity-50"
          aria-label="Send message"
          style={{ minHeight: '44px' }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
