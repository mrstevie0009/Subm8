// src/app/[locale]/signup/page.tsx
'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';

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
      className={`cursor-pointer transition-all duration-200 bg-black/20 border-white/10 hover:bg-black/30 ${
        isSelected ? 'ring-2 ring-white/50 bg-black/30' : ''
      }`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect()}
      aria-pressed={isSelected || undefined}
    >
      <CardContent className="p-4 text-center">
        <div className="mb-2 text-2xl">{emoji}</div>
        <h3 className="text-white mb-2">{title}</h3>
        <p className="text-white/70 text-sm leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
}

/* ----------------- Seite ----------------- */
export default function SignupStartPage() {
  const router = useRouter();
  const locale = useLocale();

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

  async function checkHandleAvailability(h: string): Promise<'ok' | 'taken' | 'skip' | 'error'> {
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

      const available =
        isHandleAvailableResponse(data) ? data.available : false;

      if (available) {
        setHandleState('ok');
        setHandleMsg('');
        return 'ok';
      } else {
        setHandleState('taken');
        setHandleMsg('This username is already taken.');
        return 'taken';
      }
    } catch {
      setHandleState('error');
      setHandleMsg('Could not check availability. Try again.');
      return 'error';
    }
  }

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
  }, [username, touched]);

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
        } catch {
          /* ignore json parse errors */
        }

        if (!ok) {
          const err = readErrorMessage(payload);
          if (res.status === 409 || (err && /exist|taken|vergeben/i.test(err))) {
            setHandleState('taken');
            setHandleMsg('This username is already taken.');
          } else {
            setHandleState('error');
            setHandleMsg(err || 'Signup could not start.');
          }
          started.current = false;
          setBusy(false);
          return;
        }

        router.push(`/${locale}/signup/account?handle=${encodeURIComponent(h)}&role=${roleDb}`);
      } catch {
        setHandleState('error');
        setHandleMsg('Network error. Please try again.');
        started.current = false;
        setBusy(false);
      }
    },
    [router, locale, handleState]
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
    <div
      className="relative grid min-h-[90svh] place-items-center p-4
                 bg-[#0b0b0c] overflow-hidden rounded-2xl
                 [background-image:radial-gradient(00%_40%_at_50%_0%,rgba(255,255,255,.08),transparent_60%)]"
    >
      {/* weiche Blur-Blobs */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-purple-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-purple-500/20 blur-[90px]" />

      <div className="w-full max-w-md">
        <Card className="rounded-2xl bg-white/5 backdrop-blur-xl ring-1 ring-white/50 shadow-[0_8px_30px_rgba(0,0,0,.35)] overflow-hidden">
          <CardContent className="p-8 bg-[rgba(162,89,255,0.45)]">
            {/* Header */}
            <div className="text-center mb-8">
              <p className="text-white/80 mb-2">Welcome to</p>
              <Link
                href={`/${locale}`}
                prefetch={false}
                className="text-white text-4xl mb-4 inline-block font-extrabold"
              >
                Subm8
              </Link>
              <p className="text-white/70">Choose a username to get started.</p>
            </div>

            {/* Formular (Enter löst submit aus) */}
            <form className="space-y-6" onSubmit={onSubmit} noValidate>
              {/* Username Input mit @ */}
              <div>
                {/* Nur Input + @ sind relativ zueinander */}
                <div className="relative">
                  <div
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/70 select-none"
                    aria-hidden
                  >
                    @
                  </div>
                  <Input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => onUsernameChange(e.target.value)}
                    onBlur={() => setTouched(true)}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    disabled={busy}
                    aria-invalid={showFormatError || showTakenError ? true : undefined}
                    className={`pl-8 bg-black/30 border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20 lowercase ${
                      showFormatError || showTakenError ? 'border-red-400/70 focus:ring-red-400/30' : ''
                    }`}
                  />
                </div>

                {/* Helper/Fehlermeldung außerhalb, damit die Höhe den @-Anker nicht beeinflusst */}
                {showHelperRow && (
                  <div className="mt-2 text-[12px]">
                    {showFormatError && (
                      <span className="text-red-300">3–20 chars, a–z, 0–9, underscore.</span>
                    )}
                    {!showFormatError && handleState === 'checking' && (
                      <span className="text-white/70">Checking availability…</span>
                    )}
                    {!showFormatError && handleState === 'taken' && (
                      <span className="text-red-300">{handleMsg || 'This username is already taken.'}</span>
                    )}
                    {!showFormatError && handleState === 'error' && (
                      <span className="text-yellow-200">{handleMsg || 'Could not check availability.'}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Account Type Selection */}
              <div>
                <p className="text-white/80 mb-4 text-center">Select your Account Type</p>
                <div className="grid grid-cols-2 gap-4">
                  <AccountTypeCard
                    type="sub"
                    emoji="😊"
                    title="I am a Sub"
                    description="My fulfillment lies in serving and following."
                    isSelected={selected === 'sub'}
                    onSelect={() => onSelect('sub')}
                  />
                  <AccountTypeCard
                    type="domme"
                    emoji="👑"
                    title="I am a Domme"
                    description="I take pleasure in leading and setting the rules."
                    isSelected={selected === 'domme'}
                    onSelect={() => onSelect('domme')}
                  />
                </div>
                {submitAttempted && !selected && (
                  <div className="mt-2 text-center text-[12px] text-red-300">
                    Please select your account type.
                  </div>
                )}
              </div>

              {/* Kein Button — Enter im Username-Feld triggert onSubmit */}
              <div className="text-center text-xs text-white/60">
                Press <kbd className="px-1 py-0.5 rounded border border-white/20">Enter</kbd> to continue.
              </div>
            </form>

            {/* Login Link */}
            <div className="mt-6 text-center">
              <p className="text-white/70">
                Already have an account?{' '}
                <Link
                  href={`/${locale}/signin`}
                  prefetch={false}
                  className="text-purple-300 hover:text-purple-200 underline transition-colors"
                >
                  Login
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
