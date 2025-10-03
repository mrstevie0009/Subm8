//src/components/ui/Toaster.tsx
'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';

type Kind = 'success' | 'error' | 'info';
type ToastDetail = {
  id?: string;
  title?: string;
  message: string;
  kind?: Kind;
  duration?: number;      // ms
  icon?: 'check' | 'trash' | 'post' | 'info';
};

function Icon({ kind, icon = 'info' }: { kind: Kind; icon?: ToastDetail['icon'] }) {
  const k = icon ?? (kind === 'success' ? 'check' : kind === 'error' ? 'info' : 'info');
  const stroke = 'currentColor';
  if (k === 'check') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke={stroke} strokeWidth="2">
        <path d="M5 12.5 10 17l9-10" />
      </svg>
    );
  }
  if (k === 'trash') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke={stroke} strokeWidth="2">
        <path d="M3 6h18M8 6v-2h8v2M6 6l1 14h10l1-14" />
      </svg>
    );
  }
  if (k === 'post') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke={stroke} strokeWidth="2">
        <path d="M4 4h16v16H4z" />
        <path d="M7 8h10M7 12h10M7 16h7" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke={stroke} strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 17h.01" />
    </svg>
  );
}

export default function Toaster({ position = 'bottom' }: { position?: 'top' | 'bottom' }) {
  const [items, setItems] = React.useState<Array<Required<ToastDetail>>>([]);

  React.useEffect(() => {
    const onToast = (e: Event) => {
      const { detail } = e as CustomEvent<ToastDetail>;
      if (!detail || !detail.message) return;
      const id = detail.id ?? crypto.randomUUID();
      const kind: Kind = detail.kind ?? 'info';
      const duration = Math.max(1200, detail.duration ?? 3400);
      const title = detail.title ?? (kind === 'success' ? 'Erfolg' : kind === 'error' ? 'Fehler' : '');
      const icon = detail.icon ?? (kind === 'success' ? 'check' : kind === 'error' ? 'info' : 'info');
      const t = { id, title, message: detail.message, kind, duration, icon };

      setItems((prev) => [...prev, t]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== id));
      }, duration);
    };
    window.addEventListener('ui:toast', onToast as EventListener);
    return () => window.removeEventListener('ui:toast', onToast as EventListener);
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div
        className={`fixed z-[2147483606] ${position === 'top' ? 'top-3' : 'bottom-3'} left-1/2 -translate-x-1/2
                    sm:left-auto sm:right-4 sm:translate-x-0 flex flex-col gap-2 w-[min(92vw,420px)]`}
        role="status"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className="group relative overflow-hidden rounded-2xl border border-white/12 bg-black/70 backdrop-blur
                       text-white shadow-2xl px-3 py-2.5 animate-[toast-in_260ms_ease-out]"
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 grid size-8 place-items-center rounded-full border ${
                  t.kind === 'success'
                    ? 'text-[var(--purple)] border-[var(--purple)]/40 bg-[var(--purple)]/15'
                    : t.kind === 'error'
                    ? 'text-red-300 border-red-400/40 bg-red-500/10'
                    : 'text-white/85 border-white/25 bg-white/10'
                }`}
                aria-hidden
              >
                <Icon kind={t.kind} icon={t.icon} />
              </div>
              <div className="min-w-0 flex-1">
                {t.title && <div className="text-[13px] font-semibold leading-tight">{t.title}</div>}
                <div className="text-[13px] opacity-90 break-words">{t.message}</div>
              </div>
              <button
                type="button"
                onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
                className="opacity-70 hover:opacity-100 transition px-1 -mr-1"
                aria-label="Schließen"
              >
                ✕
              </button>
            </div>
            {/* progress bar */}
            <div
              className={`absolute left-0 bottom-0 h-0.5 ${
                t.kind === 'success' ? 'bg-[var(--purple)]' : t.kind === 'error' ? 'bg-red-400' : 'bg-white/60'
              }`}
              style={{ width: '100%', transformOrigin: 'left', animation: `toast-bar ${t.duration}ms linear forwards` }}
            />
          </div>
        ))}
      </div>

      <style jsx global>{`
        @keyframes toast-in {
          0% { transform: translateY(8px); opacity: .0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes toast-bar {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
      `}</style>
    </>,
    document.body
  );
}