// src/components/CommunityJoinButton.tsx
'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';

type JoinPolicy = 'OPEN' | 'INVITE_ONLY' | 'DOMME_ONLY' | 'SUB_ONLY';
type Role = 'DOMME' | 'SUBMISSIVE' | null;

type Props = {
  slug: string;
  initialJoined: boolean;
  initialMembers: number;

  /** optional: für clientseitiges Deaktivieren je nach Policy/Rolle */
  policy?: JoinPolicy;
  viewerRole?: Role;
};

function canJoinByRole(policy?: JoinPolicy, role?: Role): boolean {
  if (!policy) return true;
  if (policy === 'INVITE_ONLY') return false; // nur per Einladung
  if (policy === 'DOMME_ONLY') return role === 'DOMME';
  if (policy === 'SUB_ONLY') return role === 'SUBMISSIVE';
  return true; // OPEN
}

function blockedHint(policy?: JoinPolicy): string | undefined {
  if (policy === 'INVITE_ONLY') return 'Invite only';
  if (policy === 'DOMME_ONLY') return 'Dommes only';
  if (policy === 'SUB_ONLY') return 'Subs only';
  return undefined;
}

function blockedLabel(policy?: JoinPolicy): string {
  return blockedHint(policy) ?? 'Join';
}

export default function CommunityJoinButton({
  slug,
  initialJoined,
  initialMembers,
  policy,
  viewerRole,
}: Props) {
  const [joined, setJoined] = React.useState(initialJoined);
  const [members, setMembers] = React.useState(initialMembers);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();

  const allowedByRole = canJoinByRole(policy, viewerRole);
  const disabled = loading || (!joined && !allowedByRole);

  async function toggle() {
    if (disabled) return;

    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(`/api/communities/${encodeURIComponent(slug)}/join`, {
        method: joined ? 'DELETE' : 'POST',
      });

      // 401: zur Login-Seite schicken (mit korrekter Locale & next)
      if (res.status === 401) {
        const next = pathname || `/communities/${slug}`;
        router.push(`/${locale}/login?next=${encodeURIComponent(next)}`);
        return;
      }

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        // 403: je nach Fehlercode verständliche Meldung anzeigen
        if (res.status === 403) {
          const code = (json?.error || '').toString();
          if (code === 'INVITE_ONLY') {
            setErr('This community is invite only.');
          } else if (code === 'ROLE_NOT_ALLOWED') {
            if (policy === 'DOMME_ONLY') setErr('Only Dommes can join this community.');
            else if (policy === 'SUB_ONLY') setErr('Only Subs can join this community.');
            else setErr('You are not allowed to join this community.');
          } else {
            setErr('Join failed. Please try again later.');
          }
          return;
        }

        // Creator darf ggf. nicht leaven etc.
        if (json?.error === 'CREATOR_CANNOT_LEAVE') {
          setErr('The creator cannot leave their own community.');
          return;
        }

        setErr('Something went wrong. Please try again.');
        return;
      }

      // Erfolg
      setJoined(!joined);
      if (typeof json?.members === 'number') setMembers(json.members);
      setErr(null);
      router.refresh(); // Header/Listen etc. aktualisieren
    } finally {
      setLoading(false);
    }
  }

  const label = joined
    ? 'Leave'
    : !allowedByRole
    ? blockedLabel(policy)
    : 'Join';

  const title =
    !joined && !allowedByRole ? blockedHint(policy) : undefined;

  const errId = err ? `join-err-${slug}` : undefined;

  return (
    <div className="text-right">
      <button
        onClick={toggle}
        disabled={disabled}
        aria-disabled={disabled || undefined}
        aria-describedby={errId}
        title={title}
        className={`px-3 py-1.5 rounded-full transition ${
          joined
            ? 'border border-white/20 hover:bg-white/5'
            : disabled
              ? 'bg-white/10 text-white/60 border border-white/15 cursor-not-allowed'
              : 'bg-[var(--purple)] hover:opacity-95'
        }`}
      >
        {loading ? '…' : label}
      </button>
      <div className="text-xs opacity-70 mt-1">{members.toLocaleString()} members</div>
      {err && (
        <div id={errId} className="mt-1 text-xs text-red-300">
          {err}
        </div>
      )}
    </div>
  );
}
