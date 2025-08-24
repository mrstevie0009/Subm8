// src/components/comments/CommentComposer.tsx
'use client';

import * as React from 'react';

type ActionFn = (formData: FormData) => void | Promise<void>;

type Props = {
  postId: string;
  /** Server Action (Rückgabewert wird ignoriert) */
  action: ActionFn;
  /** Wird nach erfolgreichem Senden aufgerufen (z.B. Count erhöhen & Composer schließen) */
  onSubmitted?: () => void;
  /** Placeholder-Text (optional) */
  placeholder?: string;
};

export default function CommentComposer({
  postId,
  action,
  onSubmitted,
  placeholder = 'Write a comment… (Shift+Enter for newline)',
}: Props) {
  const [text, setText] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const formRef = React.useRef<HTMLFormElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Enter = submit, Shift+Enter = Zeilenumbruch
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  async function handleAction(fd: FormData): Promise<void> {
    setError(null);
    const value = String(fd.get('text') ?? '').trim();
    if (!value) return;

    try {
      setSubmitting(true);
      await action(fd);          // Server Action aufrufen
      setText('');               // Eingabe leeren
      onSubmitted?.();           // Parent informieren (z.B. Count++ & Composer schließen)
      // textareaRef.current?.focus(); // optional, falls danach wieder Fokus gewünscht
    } catch {
      setError('Failed to send comment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      ref={formRef}
      action={handleAction}
      className="rounded-xl border border-white/10 bg-white/5 p-2"
      // verhindert, dass ein äußerer Card-Klick greift, falls du die ganze Card klickbar gemacht hast
      onClick={(e) => e.stopPropagation()}
    >
      <input type="hidden" name="postId" value={postId} />
      <div className="flex items-start gap-2">
        <textarea
          ref={textareaRef}
          name="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={2}
          className="flex-1 rounded-md bg-transparent border border-white/10 px-2 py-1.5 outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
        />
        <button
          type="submit"
          disabled={submitting || !text.trim()}
          className="shrink-0 px-3 py-1.5 rounded-md bg-[var(--purple)] text-white disabled:opacity-60"
        >
          {submitting ? 'Sending…' : 'Send'}
        </button>
      </div>
      {error && <div className="mt-2 text-sm text-red-400">{error}</div>}
    </form>
  );
}
