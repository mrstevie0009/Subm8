// src/components/comments/CommentComposer.tsx
'use client';

import * as React from 'react';
import { useFormStatus } from 'react-dom';
import { addCommentActionVoid } from '@/app/actions/comments';

type Props = {
  postId: string;
  /** Optional: replace the default server action */
  action?: (formData: FormData) => void | Promise<void>;
  autoFocus?: boolean;
  /** Wird nach erfolgreichem Absenden (optimistisch) ausgelöst */
  onSuccess?: () => void;
  /** Zum Schließen des Composers (auch bei Outside-Click/Cancel) */
  onCancel?: () => void;
  className?: string;
};

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      data-no-nav
      disabled={pending || disabled}
      className="px-3 py-1.5 rounded-md bg-[var(--purple)] text-white disabled:opacity-60"
    >
      {pending ? 'Sending…' : 'Send'}
    </button>
  );
}

export default function CommentComposer({
  postId,
  action,
  autoFocus = true,
  onSuccess,
  onCancel,
  className,
}: Props) {
  const [text, setText] = React.useState('');
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const formRef = React.useRef<HTMLFormElement | null>(null);

  // Focus textarea
  React.useEffect(() => {
    if (autoFocus && textareaRef.current) {
      const el = textareaRef.current;
      el.focus();
      el.selectionStart = el.value.length;
      el.selectionEnd = el.value.length;
    }
  }, [autoFocus]);

  // Close on outside click
  React.useEffect(() => {
    if (!onCancel) return;
    const onDocPointerDown = (e: PointerEvent) => {
      const root = formRef.current;
      if (root && !root.contains(e.target as Node)) {
        onCancel(); // close without sending
      }
    };
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, [onCancel]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel?.();
    }
  }

  return (
    <form
      ref={formRef}
      action={action ?? addCommentActionVoid} // server action still runs
      // Optimistisch: UI sofort schließen & Success-Callback triggern
      onSubmit={() => {
        // kurz warten, damit Browser das Submit anstößt, dann UI zu
        setTimeout(() => {
          onSuccess?.();
          onCancel?.();
          // optional: Textfeld leeren (falls nicht sofort geschlossen)
          setText('');
        }, 0);
      }}
      data-no-nav
      onClick={(e) => e.stopPropagation()} // don't bubble to card navigation
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
            >
              Cancel
            </button>
          )}
          <SubmitButton disabled={!text.trim()} />
        </div>
      </div>
    </form>
  );
}
