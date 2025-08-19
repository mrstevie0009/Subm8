// src/app/[locale]/signin/page.tsx
'use client';

import * as React from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import Link from 'next/link';

export default function SignInPage() {
  const sp = useSearchParams();
  const locale = useLocale();

  const presetEmail = sp.get('email') ?? '';
  const registered = sp.get('registered') === '1';
  const errorMsg = sp.get('error');

  const [email, setEmail] = React.useState(presetEmail);
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn('credentials', {
        redirect: true,
        callbackUrl: `/${locale}`, // Redirect ins aktuelle Locale
        email,
        password,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm p-6 space-y-6">
      <h1 className="text-xl font-semibold">Anmelden</h1>

      {(registered || errorMsg) && (
        <div
          className={`rounded-md border p-3 text-sm ${
            registered
              ? 'border-blue-200 bg-blue-50 text-blue-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {registered ? 'Registrierung erfolgreich. Bitte einloggen.' : errorMsg}
        </div>
      )}

      <form onSubmit={handleCredentials} className="space-y-3">
        <div className="space-y-1">
          <label className="block text-sm">E-Mail</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            className="w-full rounded-md border px-3 py-2"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm">Passwort</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            className="w-full rounded-md border px-3 py-2"
          />
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
