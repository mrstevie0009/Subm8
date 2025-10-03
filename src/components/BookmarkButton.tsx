'use client';

import * as React from 'react';
import { addBookmark, removeBookmark } from '@/app/actions/bookmarks';

export default function BookmarkButton({
  postId,
  initiallyBookmarked = false,
}: {
  postId: string;
  initiallyBookmarked?: boolean;
}) {
  const [bookmarked, setBookmarked] = React.useState<boolean>(initiallyBookmarked);
  const [pending, startTransition] = React.useTransition();

  const toggle = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set('postId', postId);

      // Der nächste Wert, den wir setzen werden (vor Optimismus berechnen)
      const nextValue = !bookmarked;

      // Optimistisch updaten
      setBookmarked(nextValue);

      // 👉 Event sofort nach dem lokalen Toggle feuern
      try {
        window.dispatchEvent(
          new CustomEvent('bookmark:toggled', { detail: { postId, value: nextValue } })
        );
      } catch {}

      try {
        if (bookmarked) {
          await removeBookmark(fd);
        } else {
          await addBookmark(fd);
        }
      } catch {
        // Rollback bei Fehler
        setBookmarked(!nextValue);
        try {
          window.dispatchEvent(
            new CustomEvent('bookmark:toggled', { detail: { postId, value: !nextValue } })
          );
        } catch {}
      }
    });
  };

  React.useEffect(() => {
    const onBm = (ev: Event) => {
      const ce = ev as CustomEvent<{ postId: string; value: boolean }>;
      if (ce?.detail?.postId === postId) {
        setBookmarked(ce.detail.value);
      }
    };
    window.addEventListener('bookmark:toggled', onBm as EventListener);
    return () => window.removeEventListener('bookmark:toggled', onBm as EventListener);
  }, [postId]);


  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className="group flex items-center gap-2 rounded px-2 py-1 hover:bg-white/5"
      aria-pressed={bookmarked || undefined}
      title={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
    >
      <span className="inline-grid place-items-center" style={{ width: 22, height: 22 }} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9">
          <path
            d="M7 4h10a1 1 0 0 1 1 1v15l-6-3-6 3V5a1 1 0 0 1 1-1Z"
            className={bookmarked ? 'text-[var(--purple)]' : 'text-white/90'}
          />
        </svg>
      </span>
      <span className="sr-only">{bookmarked ? 'Remove bookmark' : 'Add bookmark'}</span>
    </button>
  );
}
