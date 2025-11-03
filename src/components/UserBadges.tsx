// src/components/UserBadges.tsx
'use client';

import Image from 'next/image';
import clsx from 'clsx';

type Role = 'DOMME' | 'SUBMISSIVE' | 'domme' | 'submissive';

export function UserBadges({
  role,
  isPremium,
  isFirstAdopter,
  size = 20,
  className,
  premiumLabel,       // NEW
  firstAdopterLabel,  // NEW
}: {
  role: Role;
  isPremium?: boolean;
  isFirstAdopter?: boolean;
  size?: number;
  className?: string;
  premiumLabel?: string;
  firstAdopterLabel?: string;
}) {
  const r = String(role).toUpperCase() === 'DOMME' ? 'DOMME' : 'SUBMISSIVE';

  const srcs = {
    DOMME: {
      premium: '/Dom-Verification.png',
      first: '/Dom-First-Adopter.png',
    },
    SUBMISSIVE: {
      premium: '/Sub-Verification.png',
      first: '/Sub-First-Adopter.png',
    },
  } as const;

  return (
    <span className={clsx('inline-flex items-center gap-1 align-middle', className)}>
      {isPremium && (
        <Image
          src={srcs[r].premium}
          alt=""
          width={size}
          height={size}
          className="inline-block"
          priority={false}
          title={premiumLabel || ''}          // hover/click tooltip
        />
      )}
      {isFirstAdopter && (
        <Image
          src={srcs[r].first}
          alt=""
          width={size}
          height={size}
          className="inline-block"
          priority={false}
          title={firstAdopterLabel || ''}     // hover/click tooltip
        />
      )}
    </span>
  );
}
