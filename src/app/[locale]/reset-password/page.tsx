// src/app/[locale]/forgot-password/page.tsx
'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';

export default function ForgotPasswordPage() {
  const t = useTranslations('common.auth.forgotPage');
  const [email, setEmail] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading || !email) return;

    try {
      setLoading(true);
      setErr(null);

      // HIER der korrekte Endpoint:
      const res = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Wichtig: key heißt "email"
        body: JSON.stringify({ email }),
      });

      // Privacy: Server gibt immer { ok: true } zurück – UI zeigt generische Erfolgsmeldung
      if (!res.ok) throw new Error();
      setDone(true);
    } catch {
      setErr(t('errors.failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      {!done ? (
        <>
          <Input
            type="email"
            placeholder={t('fields.email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          {err && <div className="text-red-400">{err}</div>}
          <button
            type="submit"
            disabled={loading || !email}
            className="w-full rounded-full py-3 bg-[var(--purple)]/80 hover:bg-[var(--purple)]
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? t('buttons.sending') : t('buttons.send')}
          </button>
        </>
      ) : (
        <div className="rounded-md border border-green-400/40 bg-green-400/10 p-3 text-green-100">
          {t('success')}
        </div>
      )}
    </form>
  );
}
