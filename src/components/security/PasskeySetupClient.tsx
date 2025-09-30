'use client';

import * as React from 'react';
import { startRegistration } from '@simplewebauthn/browser';

export type PasskeySetupClientProps = {
  /** 'setup' = ersten Passkey einrichten, 'add' = weiteren hinzufügen */
  mode?: 'setup' | 'add';
};

export default function PasskeySetupClient({ mode = 'setup' }: PasskeySetupClientProps) {
  const [msg, setMsg] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function registerPasskey() {
    try {
      setLoading(true);
      setMsg(null);

      // 1) Server: Registration Options holen
      const optsRes = await fetch('/api/2fa/passkey/registration-options', { method: 'GET' });
      if (!optsRes.ok) throw new Error('options');
      const opts = await optsRes.json();

      // 2) Browser: WebAuthn-Flow starten
      const att = await startRegistration(opts);

      // 3) Server: Verify (speichert Credential)
      const verify = await fetch('/api/2fa/passkey/registration-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(att),
      });
      if (!verify.ok) throw new Error('verify');

      // 4) Erfolgreich -> Seite neu laden, damit Status "Aktiv" sieht
      if (typeof window !== 'undefined') window.location.reload();
    } catch {
      setMsg('Passkey setup failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={loading}
        onClick={registerPasskey}
        className="inline-flex items-center px-3 py-1.5 rounded-full border border-white/15 bg-white/10 hover:bg-white/15 text-sm disabled:opacity-50"
      >
        {loading ? '…' : mode === 'add' ? 'Weiteren Passkey hinzufügen' : 'Passkey einrichten'}
      </button>

      {msg && <span className="text-xs text-red-300">{msg}</span>}
    </div>
  );
}
