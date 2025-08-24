// src/app/[locale]/signup/account/page.tsx
'use client';

import * as React from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { signIn } from 'next-auth/react';

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export default function SignupAccountPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const locale = useLocale();

  const handle = (sp.get('handle') || '').toLowerCase();
  const role = sp.get('role') === 'DOMME' || sp.get('role') === 'SUBMISSIVE' ? sp.get('role')! : null;

  const [email, setEmail] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [pw2, setPw2] = React.useState('');
  const [agree, setAgree] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const ready =
    !!handle &&
    !!role &&
    isValidEmail(email) &&
    pw.length >= 8 &&
    pw === pw2 &&
    agree;

  const submit: React.FormEventHandler<HTMLFormElement> = async (ev) => {
    ev.preventDefault();
    if (!ready) return;
    try {
      setLoading(true);
      setErr(null);
      const res = await fetch('/api/signup/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          handle,
          role, // 'DOMME' | 'SUBMISSIVE'
          email,
          password: pw,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setErr(json?.error || `HTTP ${res.status}`);
        return;
      }
      // Signup fertig → z.B. auf Home oder Profil
      router.replace(`/${locale}`);
      // Signup fertig → direkt einloggen (Credentials)
      // 1) Versuch: E-Mail + Passwort
      const loginByEmail = await signIn('credentials', {
        redirect: false,
        email,
        password: pw,
        callbackUrl: `/${locale}`,
      });
      let login = loginByEmail;

      // 2) Fallback: Handle + Passwort (falls dein Provider 'handle' erwartet)
      if (loginByEmail?.error) {
        const loginByHandle = await signIn('credentials', {
          redirect: false,
          handle,
          password: pw,
          callbackUrl: `/${locale}`,
        });
        login = loginByHandle;
      }

      if (login?.error) {
        setErr(login.error);
        return;
      }

      // Weiter auf Home/Feed
      router.replace(login?.url ?? `/${locale}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  };

  const disabled = !ready || loading;

  return (
    <main className="min-h-[calc(100vh-0px)] grid place-items-center px-4">
      <section
        className="w-full max-w-[500px] rounded-3xl border border-white/10
                   bg-white/[.04] backdrop-blur shadow-app p-6 md:p-8"
      >
        <div className="text-center">
          <div className="text-sm text-muted">Create your account</div>
          <div className="text-3xl md:text-4xl font-extrabold tracking-tight">Almost there</div>
          <p className="mt-2 text-sm text-muted">
            @{handle} · {role === 'DOMME' ? 'Domme' : 'Sub'}
          </p>
        </div>

        <form className="mt-6 space-y-4" onSubmit={submit}>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl bg-white/[.06] border border-white/10 px-3 py-2 outline-none"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Minimum 8 characters"
              className="w-full rounded-xl bg-white/[.06] border border-white/10 px-3 py-2 outline-none"
              autoComplete="new-password"
            />
            <div className="mt-1 text-[12px] text-muted">
              Use at least 8 characters.
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Confirm password</label>
            <input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              className="w-full rounded-xl bg-white/[.06] border border-white/10 px-3 py-2 outline-none"
              autoComplete="new-password"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-[var(--purple)]"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
            />
            I agree to the Terms & Privacy Policy.
          </label>

          {err && <div className="text-sm text-red-400">{err}</div>}

          <button
            type="submit"
            disabled={disabled}
            className="w-full rounded-full py-3 font-semibold
                       bg-[var(--purple)]/70 hover:bg-[var(--purple)]
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating…' : 'Create account'}
          </button>

          {/* Optional: OAuth (falls vorhanden) */}
          <div className="text-center">
            <Link
              prefetch={false}
              href={`/api/auth/signin?provider=google&handle=${encodeURIComponent(
                handle
              )}&role=${role}`}
              className="inline-block mt-2 text-sm text-[var(--purple)] hover:underline"
            >
              Continue with Google
            </Link>
          </div>
        </form>

        <div className="mt-4 text-center text-sm text-muted">
          Already have an account?{' '}
          <Link href={`/${locale}/signin`} className="text-[var(--purple)] hover:underline" prefetch={false}>
            Login
          </Link>
        </div>
      </section>
    </main>
  );
}
