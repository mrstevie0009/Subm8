// src/app/[locale]/signin/page.tsx
'use client';

import * as React from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import Link from 'next/link';

export default function SignInPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const locale = useLocale();

  // sowohl ?email= als auch ?handle= als Vorausfüllung unterstützen
  const preset =
    sp.get('email') ??
    sp.get('handle')?.replace(/^@/, '') ??
    '';

  const registered = sp.get('registered') === '1';
  const topErrorMsg = sp.get('error'); // z.B. von externen Redirects

  const [identifier, setIdentifier] = React.useState(preset);
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  // lokale Fehlerdarstellung (bleibt auf der Seite)
  const [invalid, setInvalid] = React.useState(false);
  const [inlineError, setInlineError] = React.useState<string | null>(null);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setInvalid(false);
    setInlineError(null);

    try {
      const res = await signIn('credentials', {
        redirect: false,          // <— wichtig: nicht umleiten
        callbackUrl: `/${locale}`,// Ziel bei Erfolg
        identifier,               // E-Mail ODER Handle
        password,
      });

      if (res?.error) {
        // Fehler lokal anzeigen und Felder rot markieren
        setInvalid(true);
        setInlineError('E-Mail/Handle oder Passwort ist falsch.');
        return;
      }

      // Erfolg: zur Ziel-URL wechseln (Session-Cookie ist gesetzt)
      const url = res?.url ?? `/${locale}`;
      router.replace(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm p-6 space-y-6">
      <h1 className="text-xl font-semibold">Anmelden</h1>

      {(registered || topErrorMsg) && (
        <div
          className={`rounded-md border p-3 text-sm ${
            registered
              ? 'border-blue-200 bg-blue-50 text-blue-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {registered ? 'Registrierung erfolgreich. Bitte einloggen.' : topErrorMsg}
        </div>
      )}

      <form onSubmit={handleCredentials} className="space-y-3" noValidate>
        <div className="space-y-1">
          <label htmlFor="identifier" className="block text-sm">E-Mail oder Handle</label>
          <input
            id="identifier"
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
              if (invalid) { setInvalid(false); setInlineError(null); }
            }}
            type="text" // kein "email", damit @handle erlaubt ist
            autoComplete="username"
            required
            placeholder="you@example.com oder @deinhandle"
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? 'identifier-error' : undefined}
            className={`w-full rounded-md border px-3 py-2 outline-none
              ${invalid ? 'border-red-400 focus:ring-2 focus:ring-red-500/40' : 'border-white/10 focus:ring-2 focus:ring-[var(--purple)]/40'}
            `}
          />
          {invalid && (
            <p id="identifier-error" className="text-xs text-red-400">
              {inlineError}
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm">Passwort</label>
          <input
            id="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (invalid) { setInvalid(false); setInlineError(null); }
            }}
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? 'password-error' : undefined}
            className={`w-full rounded-md border px-3 py-2 outline-none
              ${invalid ? 'border-red-400 focus:ring-2 focus:ring-red-500/40' : 'border-white/10 focus:ring-2 focus:ring-[var(--purple)]/40'}
            `}
          />
          {invalid && (
            <p id="password-error" className="text-xs text-red-400">
              {inlineError}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-black py-2 text-white disabled:opacity-60"
        >
          {loading ? 'Anmelden…' : 'Anmelden'}
        </button>
      </form>

      <div className="text-center text-xs text-muted-foreground">oder</div>

      <button
        onClick={() => signIn('google', { callbackUrl: `/${locale}` })}
        className="w-full rounded-md border py-2"
      >
        Mit Google anmelden
      </button>

      <p className="text-sm">
        Noch kein Konto?{' '}
        <Link href={`/${locale}/signup`} className="text-[var(--purple)] hover:underline">
          Jetzt registrieren
        </Link>
      </p>
    </div>
  );
}
