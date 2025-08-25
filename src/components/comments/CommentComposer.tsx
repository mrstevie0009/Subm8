// src/components/comments/CommentComposer.tsx
'use client';

import * as React from 'react';
import { addCommentAction } from '@/app/actions/comments';

type ActionFn = (formData: FormData) => void | Promise<void>;

type Props = {
  postId: string;
  /** Optional: eigene Action überschreiben. Muss void | Promise<void> zurückgeben. */
  action?: ActionFn;
  /** Autofokus auf das Textfeld */
  autoFocus?: boolean;
  /** Wird nach erfolgreichem Absenden aufgerufen (z.B. Zähler erhöhen, Composer schließen) */
  onSuccess?: () => void;
  /** Wird beim Abbrechen oder nach Success (wenn du willst) genutzt, um den Composer zu schließen */
  onCancel?: () => void;
  className?: string;
};

export default function CommentComposer({
  postId,
  action,
  autoFocus = true,
  onSuccess,
  onCancel,
  className,
}: Props) {
  const [text, setText] = React.useState('');
  const [pending, startTransition] = React.useTransition();
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  // Default-Action in das erwartete Signaturformat bringen (Promise<void>)
  const defaultAction: ActionFn = async (fd: FormData) => {
    // addCommentAction kann irgendwas zurückgeben – wir ignorieren das bewusst,
    // damit die Signatur Promise<void> bleibt.
    await addCommentAction(fd);
  };

  // Wir wrappen die (ggf. übergebene) Action, um nach Erfolg Text zu leeren & Callback zu feuern
  const wrappedAction: ActionFn = async (fd) => {
    await (action ?? defaultAction)(fd);
    // nur wenn das Absenden ohne Throw durch ging:
    setText('');
    onSuccess?.();
  };

  React.useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
      // Cursor ans Ende
      const el = textareaRef.current;
      el.selectionStart = el.value.length;
      el.selectionEnd = el.value.length;
    }
  }, [autoFocus]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel?.();
    }
  }

  return (
    <form
      action={wrappedAction}
      // verhindert, dass der Klick auf den Composer die Card-Navigation auslöst
      data-no-nav
      onClick={(e) => e.stopPropagation()}
      className={className ?? 'mt-3 rounded-xl border border-white/10 bg-white/5 p-2'}
    >
      <input type="hidden" name="postId" value={postId} />

      <div className="flex items-start gap-2">
        <textarea
          ref={textareaRef}
          name="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Write a comment…"
          rows={3}
          className="flex-1 rounded-md bg-transparent border border-white/10 px-2 py-1.5 outline-none focus:ring-2 focus:ring-[var(--purple)]/40 resize-vertical"
        />

        <div className="shrink-0 flex flex-col gap-2">
          {onCancel && (
            <button
              type="button"
              data-no-nav
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              className="px-3 py-1.5 rounded-md border border-white/15 hover:bg-white/5"
              disabled={pending}
            >
              Cancel
            </button>
          )}

          <button
            type="submit"
            data-no-nav
            disabled={pending || !text.trim()}
            // Optimistisches Feedback: Wir lassen React die Action ausführen,
            // aber sorgen mit Transition für Disabled/Loading-State.
            onClick={(e) => {
              e.stopPropagation();
              // Optional: Hier kein setState, das übernimmt wrappedAction nach Erfolg.
              startTransition(() => {});
            }}
            className="px-3 py-1.5 rounded-md bg-[var(--purple)] text-white disabled:opacity-60"
          >
            {pending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </form>
  );
}
