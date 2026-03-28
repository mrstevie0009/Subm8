// src/components/RichText.tsx
'use client';

import * as React from 'react';
import Link from 'next/link';

type Props = {
  text: string;
  locale: string;
  className?: string;
  /** Nur Styling-Hinweis – keine Netz-Checks hier */
  validateMentions?: boolean;
  /**
   * Steuert die Link-Farbe für @mentions/#hashtags.
   * - "default": globales Styling (lila)
   * - "chat": für Chat-Bubbles (hell/weiß auf lila Hintergrund)
   */
  variant?: 'default' | 'chat';
};

// Grund-Patterns
const MENTION = /@[a-z0-9_]{1,20}\b/gi;
const HASHTAG = /#[\p{L}\p{N}_]{1,50}\b/giu;
// Nur https?:// – keine javascript:, data:, vbscript: URIs möglich
const SAFE_URL = /https?:\/\/[^\s<>"'()[\]{}]+/gi;

// Tokenizer, der Mentions/Hashtags/URLs isoliert
const TOKEN = new RegExp(
  `(${MENTION.source})|(${HASHTAG.source})|(${SAFE_URL.source})`,
  'giu'
);

// Für typsichere Einzelprüfung (kein .test auf /g-Regex)
const IS_MENTION = new RegExp(`^${MENTION.source}$`, 'iu');
const IS_HASHTAG = new RegExp(`^${HASHTAG.source}$`, 'iu');
// Doppelt absichern: auch beim Rendern nur https?:// zulassen
const IS_SAFE_URL = /^https?:\/\//i;

export default function RichText({
  text,
  locale,
  className,
  variant = 'default',
}: Props) {
  const parts = React.useMemo(() => text.split(TOKEN).filter(Boolean), [text]);

  // Link-Styles: nur im Chat anders
  const linkCls =
    variant === 'chat'
      ? 'text-purple-800 underline decoration-purple-800 hover:decoration-purple font-semibold'
      : 'text-[var(--purple)] hover:underline font-medium';

  // Hilfs-Handler: verhindert, dass z. B. Cards den Klick „schlucken"
  const stop = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  return (
    <span className={className}>
      {parts.map((part, i) => {
        // @mention
        if (IS_MENTION.test(part)) {
          const handle = part.slice(1).toLowerCase();
          return (
            <Link
              key={`m-${i}-${handle}`}
              href={`/${locale}/u/${handle}`}
              className={linkCls}
              prefetch={false}
              title={`@${handle}`}
              data-no-nav
              onClick={stop}
              onMouseDown={stop}
              onTouchStart={stop}
            >
              {part}
            </Link>
          );
        }

        // #hashtag
        if (IS_HASHTAG.test(part)) {
          const tag = part.slice(1);
          return (
            <Link
              key={`h-${i}-${tag}`}
              href={`/${locale}/search?q=${encodeURIComponent('#' + tag)}`}
              className={linkCls}
              prefetch={false}
              title={`#${tag}`}
              data-no-nav
              onClick={stop}
              onMouseDown={stop}
              onTouchStart={stop}
            >
              {part}
            </Link>
          );
        }

        // URL
        if (IS_SAFE_URL.test(part)) {
          const href = part.replace(/[.,!?)]+$/, '');
          return (
            <a
              key={`u-${i}`}
              href={href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className={linkCls}
              onClick={stop}
              onMouseDown={stop}
              onTouchStart={stop}
            >
              {href}
            </a>
          );
        }

        // Plain Text
        return <React.Fragment key={`t-${i}`}>{part}</React.Fragment>;
      })}
    </span>
  );
}