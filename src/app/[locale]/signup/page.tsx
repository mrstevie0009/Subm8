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
  const started = React.useRef(false);

  // wenn beides vorhanden → API anstoßen & weiter zur Account-Seite
  const tryProceed = React.useCallback(async (h: string, r: RoleUi | null) => {
    if (!r || !validHandle(h) || started.current) return;
    started.current = true;
    setBusy(true);

    const roleDb: RoleDb = r === 'domme' ? 'DOMME' : 'SUBMISSIVE';

    try {
      // optionaler Start-Call (falls du Vorab-Validierung/Reservation möchtest)
      await fetch('/api/signup/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ handle: h, role: roleDb }),
      });
    } catch {
      // Ignorieren – die nächste Seite validiert erneut
    } finally {
      router.push(
        `/${locale}/signup/account?handle=${encodeURIComponent(h)}&role=${roleDb}`
      );
    }
  }, [router, locale]);

  const onUsernameChange = (value: string) => {
    const cleaned = sanitizeHandle(value);
    setUsername(cleaned);
    if (!touched) setTouched(true);
    // direkt prüfen
    if (selected) tryProceed(cleaned, selected);
  };

  const onSelect = (type: RoleUi) => {
    setSelected(type);
    if (username) tryProceed(username, type);
  };

  const handleOk = !touched ? true : validHandle(username);

  return (
    <div className="min-h-[100svh] bg-black grid place-items-center p-4">
      <div className="w-full max-w-md">
        <Card className="bg-black/20 border-white/10 backdrop-blur-sm">
          {/* violette Fläche wie im Figma */}
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

            <div className="space-y-6">
              {/* Username Input mit @ */}
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/70 select-none">
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
                  className={`pl-8 bg-black/30 border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20 lowercase ${
                    touched && !handleOk ? 'border-red-400/70' : ''
                  }`}
                />
                {touched && !handleOk && (
                  <div className="mt-2 text-[12px] text-red-300">
                    3–20 chars, a–z, 0–9, underscore.
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
              </div>

              {/* Login Link */}
              <div className="text-center">
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
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
