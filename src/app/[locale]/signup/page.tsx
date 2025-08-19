// src/app/[locale]/signup/page.tsx
'use client';

import * as React from 'react';
import { signIn } from 'next-auth/react';
import { useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';

export default function SignUpPage() {
  const locale = useLocale();
  const sp = useSearchParams();
  const presetEmail = sp.get('email') ?? '';

  const [displayName, setDisplayName] = React.useState('');
  const [handle, setHandle] = React.useState('');
  const [email, setEmail] = React.useState(presetEmail);
  const [password, setPassword] = React.useState('');
  const [password2, setPassword2] = React.useState('');
  const [role, setRole] = React.useState<'DOMME' | 'SUBMISSIVE'>('SUBMISSIVE'); // Default: Sub
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const fd = new FormData(e.currentTarget);
      // WICHTIG: Rolle sicherstellen (falls State vs. DOM abweicht)
      fd.set('role', role);

      // 1) User anlegen
      const res = await fetch('/api/register', { method: 'POST', body: fd });
      const body = await res.json().catch(() => ({} as any));
      if (!res.ok || !body?.ok) {
        setError(body?.error || 'Registrierung fehlgeschlagen.');
        return;
      }

      // 2) Direkt einloggen (Credentials Provider)
      const si = await signIn('credentials', {
        redirect: true,
        callbackUrl: `/${locale}`,
        email,
        password,
      });
      if ((si as any)?.error) {
        setError('Login nach Registrierung fehlgeschlagen.');
      }
    } catch (err: any) {
      setError(err?.message || 'Unerwarteter Fehler.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm p-6 space-y-6">
      <h1 className="text-xl font-semibold">Registrieren</h1>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-1">
          <label className="block text-sm">Anzeigename</label>
          <input
            name="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className="w-full rounded-md border px-3 py-2"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm">Handle (3–20, a–z 0–9 _ .)</label>
          <input
            name="handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            required
            className="w-full rounded-md border px-3 py-2"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm">E-Mail</label>
          <input
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-md border px-3 py-2"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm">Passwort</label>
          <input
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
            className="w-full rounded-md border px-3 py-2"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm">Passwort wiederholen</label>
          <input
            name="password2"
            type="password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            minLength={6}
            required
            className="w-full rounded-md border px-3 py-2"
          />
        </div>

        {/* Rollenwahl */}
        <fieldset className="space-y-2">
          <legend className="block text-sm font-medium">Rolle</legend>
          <div className="flex gap-4 items-center">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="role"
                value="DOMME"
                checked={role === 'DOMME'}
                onChange={() => setRole('DOMME')}
                required
              />
              <span>Domme</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="role"
                value="SUBMISSIVE"
                checked={role === 'SUBMISSIVE'}
                onChange={() => setRole('SUBMISSIVE')}
                required
              />
              <span>Sub</span>
            </label>
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-black py-2 text-white disabled:opacity-60"
        >
          {loading ? 'Wird erstellt…' : 'Registrieren'}
        </button>
      </form>
    </div>
  );
}
