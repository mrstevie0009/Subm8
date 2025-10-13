// src/components/ToastHost.tsx
'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { toast } from '@/lib/toast';
import type { ToastPayload } from '@/lib/toast';

type T = Required<ToastPayload>;

const CheckIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
    <circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="2" fill="none" />
    <path d="M7 12.5l3 3 7-7" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" />
  </svg>
);

const ErrorIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
    <circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="2" fill="none" />
    <path d="M12 7v7m0 3.5h.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

export default function ToastHost() {
  const [items, setItems] = React.useState<T[]>([]);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    return toast._subscribe((t) => {
      setItems((prev) => [...prev, t]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== t.id));
      }, t.durationMs);
    });
  }, []);

  if (!mounted) return null;

  const node = (
    <div
      className="fixed left-1/2 top-4 z-[2147483606] -translate-x-1/2 w-[min(92vw,560px)] space-y-2"
      aria-live="polite"
      aria-atomic="true"
    >
      {items.map((t) => {
        // Farbschema an dein Theme angepasst
        const color =
          t.variant === 'success' ? 'text-subm8-purple' :
          t.variant === 'error'   ? 'text-red-400'     :
                                    'text-fg';

        return (
          <div
            key={t.id}
            className="pointer-events-auto rounded-app border border-sub bg-card backdrop-blur-md shadow-app px-4 py-3 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200"
            role="status"
          >
            <div className={`${color} shrink-0 grid place-items-center w-8 h-8 rounded-full bg-card`}>
              {t.icon ?? (t.variant === 'success' ? <CheckIcon/> : t.variant === 'error' ? <ErrorIcon/> : <CheckIcon/>)}
            </div>
            <div className="min-w-0">
              {t.title && <div className="font-semibold text-fg">{t.title}</div>}
              {t.message && <div className="text-sm text-muted">{t.message}</div>}
            </div>
            <button
              className="ml-auto text-muted hover:text-fg text-sm"
              onClick={() => setItems((prev) => prev.filter((x) => x.id !== t.id))}
              aria-label="Schließen"
              title="Schließen"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );

  return createPortal(node, document.body);
}
