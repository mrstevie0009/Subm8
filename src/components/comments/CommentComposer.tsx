'use client';
import * as React from 'react';
import { createPortal } from 'react-dom'; // ⬅️ NEU
import { useFormStatus, useFormState } from 'react-dom';
import type { AddCommentResult } from '@/app/actions/comments';
import { addCommentAction } from '@/app/actions/comments';
import { useTranslations } from 'next-intl';


type Props = {
  postId: string;
  action?: (formData: FormData) => void | Promise<void>; // optional: eigene Action
  autoFocus?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
  disableInternalFloating?: boolean; 
};

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  const t = useTranslations('common.communities.share');
  return (
    <button
      type="submit"
      data-no-nav
      disabled={pending || disabled}
      className="px-3 py-1.5 rounded-md bg-[var(--purple)] text-white disabled:opacity-60"
    >
      {pending ? t('overlay.sending') : t('overlay.send')}
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
  disableInternalFloating = false,
}: Props) {
  const t = useTranslations('common.comments');
  const ta = useTranslations('common.communities.share');

  const [text, setText] = React.useState('');
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const formRef = React.useRef<HTMLFormElement | null>(null);
  

  // ⬇️ NEU: Floating-Modus (bei Mobile + Fokus)
  const [isFloating, setIsFloating] = React.useState(false);
  const [kbBottom, setKbBottom] = React.useState(0); // px über Tastatur bleiben
  const isMobile = typeof window !== 'undefined' && window.matchMedia?.('(max-width: 768px)').matches;




  React.useEffect(() => {
    const handler = () => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      // Cursor ans Ende
      const end = el.value.length;
      try { el.setSelectionRange(end, end); } catch {}
    };
    window.addEventListener('composer:focus', handler);
    // bei Mount auch direkt versuchen:
    handler();
    return () => window.removeEventListener('composer:focus', handler);
  }, []);


  React.useEffect(() => {
    if (!isFloating || typeof window === 'undefined' || !('visualViewport' in window)) return;

    const vv = window.visualViewport!;
    const update = () => {
      // Wie viel der visuelle Viewport vom Layout-Viewport nach oben „abgeschnitten“ ist
      const keyboardOverlap =
        Math.max(0, (window.innerHeight - (vv.height ?? window.innerHeight) - (vv.offsetTop ?? 0)));
      setKbBottom(keyboardOverlap);
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [isFloating]);

  // Focus textarea
  React.useEffect(() => {
    if (autoFocus && textareaRef.current) {
      const el = textareaRef.current;
      el.focus();
      el.selectionStart = el.value.length;
      el.selectionEnd = el.value.length;
    }
  }, [autoFocus]);

  // Close on outside click (nur wenn NICHT floating, sonst ist "Outside" die Page)
  React.useEffect(() => {
    if (!onCancel) return;
    const onDocPointerDown = (e: PointerEvent) => {
      if (isFloating) return;
      const root = formRef.current;
      if (root && !root.contains(e.target as Node)) onCancel();
    };
    document.addEventListener('pointerdown', onDocPointerDown);
    return () => document.removeEventListener('pointerdown', onDocPointerDown);
  }, [onCancel, isFloating]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel?.();
    }
  }

  // ⬇️ NEU: beim Fokus in den Floating-Modus gehen (nur Mobile)
  const handleFocus = () => {
    if (isMobile && !disableInternalFloating) setIsFloating(true);
  };
  const exitFloating = () => setIsFloating(false);
  type ComposerState = AddCommentResult;
  const initialState: ComposerState = { ok: false, error: 'INVALID_INPUT' };
  // Wrapper mit der von useFormState erwarteten Signatur: (prevState, formData) => Promise<State>
  const reducer = React.useCallback(
    async (_prev: ComposerState, formData: FormData): Promise<ComposerState> => {
      if (action) {
        await action(formData);                // Fremd-Action ausführen
        // Wir kennen deren Rückgabe nicht -> als Erfolg behandeln
        return { ok: true, id: 'local' } as ComposerState;
      }
      return await addCommentAction(formData); // Standard-Server-Action mit { ok, id|error }
    },
    [action]
  );
  const [state, formAction] = useFormState<ComposerState, FormData>(reducer, initialState);

  React.useEffect(() => {
    if (state.ok) {
      onSuccess?.();
      onCancel?.();
      setText('');
      exitFloating();
    } else {
      // Optional: Fehler-Feedback anhand state.error
      // z.B. toast(errorMap[state.error])
    }
  }, [state, onCancel, onSuccess]);

  const Form = (
    <form
      ref={formRef}
      action={formAction}
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
          onFocus={handleFocus}           // ⬅️ NEU
          placeholder={t('placeholder')}
          rows={3}
          inputMode="text"
          enterKeyHint="send"
          className="flex-1 rounded-md bg-transparent border border-white/10 px-2 py-1.5 outline-none focus:ring-2 focus:ring-[var(--purple)]/40 resize-vertical"
        />

        <div className="shrink-0 flex flex-col gap-2">
          {onCancel && (
            <button
              type="button"
              data-no-nav
              onClick={(e) => { e.stopPropagation(); onCancel(); exitFloating(); }}
              className="px-3 py-1.5 rounded-md border border-white/15 hover:bg-white/5"
            >
              {ta('overlay.cancel')}
            </button>
          )}
          <SubmitButton disabled={!text.trim()} />
        </div>
      </div>
    </form>
  );

  // ⬇️ NEU: Floating-Wrapper (fixiert, via Portal), wenn aktiv
  if (isFloating && !disableInternalFloating && typeof document !== 'undefined') {
    return createPortal(
      <div
        data-composer-root               // ⬅️ NEU: Marker
        className="fixed left-0 right-0 z-[2147483604]"
        style={{ bottom: `calc(${kbBottom}px + env(safe-area-inset-bottom))`, padding: '8px 12px' }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mx-auto max-w-[720px]">
          <div className="rounded-2xl border border-white/12 bg-[#0b0b0d]/95 backdrop-blur p-2 shadow-2xl">
            {Form}
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // ⬇️ Inline-Rendering IMMER in einen Wrapper mit Marker packen
  return (
    <div data-composer-root onPointerDown={(e) => e.stopPropagation()}>
      {Form}
    </div>
  );
}
