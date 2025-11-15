//src/components/CommunityJoinButton.tsx
'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

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
  if (policy === 'INVITE_ONLY') return false;
  if (policy === 'DOMME_ONLY') return role === 'DOMME';
  if (policy === 'SUB_ONLY') return role === 'SUBMISSIVE';
  return true; // OPEN
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
  const t = useTranslations('communities.communities.join');

  const allowedByRole = canJoinByRole(policy, viewerRole);
  const disabled = loading || (!joined && !allowedByRole);

  const hintInvite = t('hints.inviteOnly');
  const hintDomme = t('hints.dommeOnly');
  const hintSub = t('hints.subOnly');

  const blockedHint =
    policy === 'INVITE_ONLY' ? hintInvite :
    policy === 'DOMME_ONLY'  ? hintDomme  :
    policy === 'SUB_ONLY'    ? hintSub    :
    undefined;

  const blockedLabel = blockedHint ?? t('actions.join');

  async function toggle() {
    if (disabled) return;

    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(`/api/communities/${encodeURIComponent(slug)}/join`, {
        method: joined ? 'DELETE' : 'POST',
      });

      // 401 → zur Sign-in Seite (Locale + next)
      if (res.status === 401) {
        const next = pathname || `/communities/${slug}`;
        router.push(`/${locale}/signin?next=${encodeURIComponent(next)}`);
        return;
      }

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        // 403 → genauere Fehlermeldung
        if (res.status === 403) {
          const code = (json?.error || '').toString();
          if (code === 'INVITE_ONLY') {
            setErr(t('errors.inviteOnly'));
          } else if (code === 'ROLE_NOT_ALLOWED') {
            if (policy === 'DOMME_ONLY') setErr(t('errors.roleNotAllowed.dommeOnly'));
            else if (policy === 'SUB_ONLY') setErr(t('errors.roleNotAllowed.subOnly'));
            else setErr(t('errors.roleNotAllowed.generic'));
          } else {
            setErr(t('errors.joinFailed'));
          }
          return;
        }

        if (json?.error === 'CREATOR_CANNOT_LEAVE') {
          setErr(t('errors.creatorCannotLeave'));
          return;
        }

        setErr(t('errors.generic'));
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
    ? t('actions.leave')
    : !allowedByRole
    ? blockedLabel
    : t('actions.join');

  const title = !joined && !allowedByRole ? blockedHint : undefined;

  const errId = err ? `join-err-${slug}` : undefined;
  const membersLabel = t('members', { count: new Intl.NumberFormat(locale).format(members) });

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
              : 'bg-[var(--purple)] hover:opacity-95 text-white'
        }`}
      >
        {loading ? t('actions.loading') : label}
      </button>
      <div className="text-xs opacity-70 mt-1">{membersLabel}</div>
      {err && (
        <div id={errId} className="mt-1 text-xs text-red-300">
          {err}
        </div>
      )}
    </div>
  );
}
