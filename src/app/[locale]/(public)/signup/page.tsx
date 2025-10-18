// src/app/[locale]/signup/page.tsx
'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

// shadcn/ui
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

type RoleUi = 'sub' | 'domme';
type RoleDb = 'SUBMISSIVE' | 'DOMME';

/* ----------------- kleine Hilfen ----------------- */
const sanitizeHandle = (v: string) => v.toLowerCase().replace(/[^a-z0-9_]/g, '');
const validHandle = (v: string) => /^[a-z0-9_]{3,20}$/.test(v);

function isHandleAvailableResponse(v: unknown): v is { available: boolean } {
  return typeof v === 'object' && v !== null && 'available' in v &&
    typeof (v as Record<string, unknown>).available === 'boolean';
}
function readErrorMessage(v: unknown): string | undefined {
  if (typeof v !== 'object' || v === null) return undefined;
  const val = (v as Record<string, unknown>).error;
  return typeof val === 'string' ? val : undefined;
}

/* ----------------- Account-Type-Karte ----------------- */
interface AccountTypeCardProps {
  type: RoleUi;
  emoji: string;
  title: string;
  description: string;
  isSelected: boolean;
  onSelect: () => void;
}

function AccountTypeCard({
  emoji, title, description, isSelected, onSelect,
}: AccountTypeCardProps) {
  return (
    <Card
      className={`cursor-pointer transition-all duration-200 bg-black/20 border-white/10 hover:bg-black/30 ${isSelected ? 'ring-2 ring-white/50 bg-black/30' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect()}
      aria-pressed={isSelected || undefined}
    >
      <CardContent className="p-3 sm:p-4 text-center">
        <div className="mb-1.5 sm:mb-2 text-xl sm:text-2xl">{emoji}</div>
        <h3 className="text-white mb-1.5 sm:mb-2 text-base sm:text-lg">{title}</h3>
        <p className="text-white/70 text-[13px] sm:text-sm leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
}

/* ----------------- Seite ----------------- */
export default function SignupStartPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('auth.auth.signup');
  const tc = useTranslations('common');

  const [username, setUsername] = React.useState('');
  const [touched, setTouched] = React.useState(false);
  const [selected, setSelected] = React.useState<RoleUi | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [submitAttempted, setSubmitAttempted] = React.useState(false);

  // Reihenfolge-Logik
  const [roleSelectedFirst, setRoleSelectedFirst] = React.useState(false);

  // Handle-Verfügbarkeit
  type HandleState = 'idle' | 'checking' | 'ok' | 'taken' | 'error';
  const [handleState, setHandleState] = React.useState<HandleState>('idle');
  const [handleMsg, setHandleMsg] = React.useState<string>('');

  // Debounce für Availability-Check
  const debounceTimer = React.useRef<number | null>(null);

  // Merker gegen Double-submit/-navigate
  const started = React.useRef(false);

  const handleFormatOk = !touched ? true : validHandle(username);
  const showFormatError = touched && !handleFormatOk;
  const showTakenError = handleState === 'taken';

  /** ←——— FIX: als useCallback, damit der Effekt eine stabile Dep bekommt */
  const checkHandleAvailability = React.useCallback(async (h: string): Promise<'ok' | 'taken' | 'skip' | 'error'> => {
    if (!validHandle(h)) return 'skip';
    setHandleState('checking');
    setHandleMsg('');
    try {
      const res = await fetch(`/api/signup/handle-available?handle=${encodeURIComponent(h)}`, {
        method: 'GET',
        headers: { accept: 'application/json' },
      });

      if (res.status === 404) {
        setHandleState('idle');
        return 'skip';
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: unknown = await res.json().catch(() => ({}));

      const available = isHandleAvailableResponse(data) ? data.available : false;

      if (available) {
        setHandleState('ok');
        setHandleMsg('');
        return 'ok';
      } else {
        setHandleState('taken');
        setHandleMsg(t('errors.handleTaken'));
        return 'taken';
      }
    } catch {
      setHandleState('error');
      setHandleMsg(t('errors.checkFailed'));
      return 'error';
    }
  }, [t]);

  // Live-Check bei Username-Änderung (debounced)
  React.useEffect(() => {
    if (!touched) return;

    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    if (!validHandle(username)) {
      setHandleState('idle');
      setHandleMsg('');
      return;
    }

    debounceTimer.current = window.setTimeout(() => {
      void checkHandleAvailability(username);
    }, 350) as unknown as number;

    return () => {
      if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    };
  }, [username, touched, checkHandleAvailability]); // ←——— FIX: Funktion als Dep

  /** Weiterleitung ausführen (inkl. finaler Server-Validierung) */
  const proceed = React.useCallback(
    async (h: string, r: RoleUi) => {
      if (!validHandle(h) || !r || started.current) return;
      if (handleState === 'taken') return;

      started.current = true;
      setBusy(true);

      const roleDb: RoleDb = r === 'domme' ? 'DOMME' : 'SUBMISSIVE';

      try {
        const res = await fetch('/api/signup/start', {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ handle: h, role: roleDb }),
        });

        let ok = res.ok;
        let payload: unknown = null;
        try {
          payload = await res.json();
          if (ok && typeof payload === 'object' && payload !== null && 'ok' in payload) {
            const okVal = (payload as Record<string, unknown>).ok;
            if (typeof okVal === 'boolean' && okVal === false) ok = false;
          }
        } catch { /* ignore */ }

        if (!ok) {
          const err = readErrorMessage(payload);
          if (res.status === 409 || (err && /exist|taken|vergeben/i.test(err))) {
            setHandleState('taken');
            setHandleMsg(t('errors.handleTaken'));
          } else {
            setHandleState('error');
            setHandleMsg(err || t('errors.startFailed'));
          }
          started.current = false;
          setBusy(false);
          return;
        }

        router.push(`/${locale}/signup/account?handle=${encodeURIComponent(h)}&role=${roleDb}`);
      } catch {
        setHandleState('error');
        setHandleMsg(t('errors.network'));
        started.current = false;
        setBusy(false);
      }
    },
    [router, locale, handleState, t]
  );

  /** Username ändern — kein Auto-Redirect, nur Live-Validierung */
  function onUsernameChange(value: string) {
    const cleaned = sanitizeHandle(value);
    setUsername(cleaned);
    if (!touched) setTouched(true);
  }

  /** Rolle wählen — ggf. Auto-Redirect (nur wenn Username → Rolle) */
  async function onSelect(type: RoleUi) {
    setSelected(type);

    if (validHandle(username) && !roleSelectedFirst) {
      const status = handleState === 'ok' ? 'ok' : await checkHandleAvailability(username);
      if (status === 'ok') {
        void proceed(username, type);
      }
      return;
    }

    if (!validHandle(username)) {
      setRoleSelectedFirst(true);
    }
  }

  /** Enter (Submit) — Flow Rolle → Username */
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    setTouched(true);

    if (!validHandle(username)) return;
    if (!selected) return;

    const status = handleState === 'ok' ? 'ok' : await checkHandleAvailability(username);
    if (status === 'taken') return;

    await proceed(username, selected);
  }

  const showHelperRow =
    showFormatError || showTakenError || handleState === 'checking' || handleState === 'error';

  return (
    <div className="relative grid min-h-[100svh] place-items-center px-3 py-4 bg-[#0b0b0c] overflow-hidden rounded-none md:rounded-2xl
                   [background-image:radial-gradient(00%_40%_at_50%_0%,rgba(255,255,255,.08),transparent_60%)]"
    >
      {/* weiche Blur-Blobs */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-48 w-48 md:h-72 md:w-72 rounded-full bg-purple-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-56 w-56 md:h-80 md:w-80 rounded-full bg-purple-500/20 blur-[90px]" />

      <div className="w-full max-w-[380px] sm:max-w-md">
        <Card className="rounded-2xl bg-white/5 backdrop-blur-xl ring-1 ring-white/50 shadow-[0_8px_30px_rgba(0,0,0,.35)] overflow-hidden">
          <CardContent className="p-5 sm:p-8 bg-[rgba(162,89,255,0.45)]">
            {/* Header + Logo */}
            <div className="text-center mb-6 sm:mb-8">
              <div className="flex justify-center mb-3">
                <Image
                  src="/logo.png"
                  alt={`${tc('brand.name')} logo`}
                  width={120}
                  height={36}
                  priority
                  className="h-7 sm:h-10 w-auto drop-shadow-md"
                />
              </div>
              <p className="text-white/80 mb-1 sm:mb-2 text-[13px] sm:text-base">
                {t('welcome', { brand: tc('brand.name') })}
              </p>
              <Link
                href={`/${locale}`}
                prefetch={false}
                className="text-white text-2xl sm:text-4xl mb-3 sm:mb-4 inline-block font-extrabold leading-tight"
              >
                {tc('brand.name')}
              </Link>
              <p className="text-white/70 text-[13px] sm:text-base">{t('chooseUsername')}</p>
            </div>

            {/* Formular (Enter löst submit aus) */}
            <form className="space-y-6" onSubmit={onSubmit} noValidate>
              {/* Username Input mit @ */}
              <div>
                <div className="relative">
                  <div
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/70 select-none"
                    aria-hidden
                  >
                    @
                  </div>
                  <Input
                    type="text"
                    placeholder={t('fields.username.placeholder')}
                    value={username}
                    onChange={(e) => onUsernameChange(e.target.value)}
                    onBlur={() => setTouched(true)}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    disabled={busy}
                    aria-invalid={showFormatError || showTakenError ? true : undefined}
                    className={`pl-8 h-10 sm:h-11 bg-black/30 border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20 lowercase ${showFormatError || showTakenError ? 'border-red-400/70 focus:ring-red-400/30' : ''}`}
                  />
                </div>

                {/* Helper/Fehlermeldung */}
                {showHelperRow && (
                  <div className="mt-2 text-[12px] sm:text-[13px]">
                    {showFormatError && (
                      <span className="text-red-300">{t('fields.username.formatHelp')}</span>
                    )}
                    {!showFormatError && handleState === 'checking' && (
                      <span className="text-white/70">{t('fields.username.checking')}</span>
                    )}
                    {!showFormatError && handleState === 'taken' && (
                      <span className="text-red-300">{handleMsg || t('errors.handleTaken')}</span>
                    )}
                    {!showFormatError && handleState === 'error' && (
                      <span className="text-yellow-200">{handleMsg || t('errors.checkFailed')}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Account Type Selection */}
              <div>
                <p className="text-white/80 mb-3 sm:mb-4 text-center text-[13px] sm:text-base">{t('selectTypeTitle')}</p>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <AccountTypeCard
                    type="sub"
                    emoji="😊"
                    title={t('roleCard.sub.title')}
                    description={t('roleCard.sub.desc')}
                    isSelected={selected === 'sub'}
                    onSelect={() => onSelect('sub')}
                  />
                  <AccountTypeCard
                    type="domme"
                    emoji="👑"
                    title={t('roleCard.domme.title')}
                    description={t('roleCard.domme.desc')}
                    isSelected={selected === 'domme'}
                    onSelect={() => onSelect('domme')}
                  />
                </div>
                {submitAttempted && !selected && (
                  <div className="mt-2 text-center text-[12px] text-red-300">
                    {t('errors.selectTypeRequired')}
                  </div>
                )}
              </div>

              {/* Kein Button — Enter im Username-Feld triggert onSubmit */}
              <div className="text-center text-[11px] sm:text-xs text-white/60">
                {t('enterToContinue')}&nbsp;
                <kbd className="px-1 py-0.5 rounded border border-white/20">Enter</kbd>.
              </div>
            </form>

            {/* Login Link */}
            <div className="mt-5 sm:mt-6 text-center">
              <p className="text-white/70">
                {t('login.cta')}{' '}
                <Link
                  href={`/${locale}/signin`}
                  prefetch={false}
                  className="text-purple-300 hover:text-purple-200 underline transition-colors"
                >
                  {t('login.link')}
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
