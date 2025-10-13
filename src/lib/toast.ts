// src/lib/toast.ts
'use client';

import type { ReactNode } from 'react';

type ToastVariant = 'success' | 'error' | 'info';

export type ToastPayload = {
  id?: string;
  title?: string;
  message?: string;
  variant?: ToastVariant;
  /**
   * Sichtbarkeitsdauer in Millisekunden.
   * 👉 Globaler Default ist 2000 ms (2 Sekunden) – bei Bedarf hier ändern.
   */
  durationMs?: number;
  icon?: ReactNode;    // optional eigener Icon-Knoten
};

type Listener = (t: Required<ToastPayload>) => void;


let listeners: Listener[] = [];

// ======= Globaler Default in EINER Stelle definieren =======
const DEFAULT_DURATION_MS = 2000; // ← hier 2s einstellen/ändern
// ===========================================================


function emit(payload: ToastPayload) {
  const t: Required<ToastPayload> = {
    id: payload.id ?? crypto.randomUUID(),
    title: payload.title ?? '',
    message: payload.message ?? '',
    variant: payload.variant ?? 'info',
    durationMs: payload.durationMs ?? DEFAULT_DURATION_MS,
    icon: payload.icon ?? null,
  };
  listeners.forEach((l) => l(t));
}
  
export const toast = {
  
  // Host registriert/entfernt Listener
  _subscribe(fn: Listener) {
    listeners.push(fn);
    return () => {
      listeners = listeners.filter((x) => x !== fn);
    };
  },
  
  show(p: ToastPayload) {
    emit(p);
  },

  success(title: string, message = '') {
    emit({ title, message, variant: 'success' });
  },

  error(title: string, message = '') {
    // Fehler dürfen gern etwas länger stehen bleiben – wenn du willst.
    emit({ title, message, variant: 'error', durationMs: 3000 });
  },

  // Komforthelfer speziell fürs Posting
    /**
   * Komforthelfer speziell fürs Posting.
   * Optionaler Titel für i18n (z.B. tt('post.published')).
   */
  posted(title?: string) {
    emit({
      title: title ?? 'Post published',
      message: '',
      variant: 'success',
      durationMs: DEFAULT_DURATION_MS,
    });
  },
};
