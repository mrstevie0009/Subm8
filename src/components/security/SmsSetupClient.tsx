'use client';
import { useState } from 'react';

type ApiResp = { ok?: boolean; error?: string };

function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try {
    return JSON.stringify(e);
  } catch {
    return 'Unknown error';
  }
}

export default function SmsSetupClient({ hasPhone }: { hasPhone: boolean }) {
  const [phone, setPhone] = useState('');
  const [stage, setStage] = useState<'idle' | 'code'>('idle');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    try {
      setLoading(true);
      setErr(null);

      const r = await fetch('/api/2fa/sms/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // Dein aktueller /api/2fa/sms/start-Handler ignoriert den Body
        // (er nimmt die Telefonnummer aus der DB). Wir senden sie
        // trotzdem mit, falls du serverseitig später auf "Telefon ändern"
        // umstellst.
        body: JSON.stringify({ phone }),
      });

      const j = (await r.json()) as ApiResp;
      if (!r.ok || !j?.ok) throw new Error(j?.error || 'start failed');
      setStage('code');
    } catch (e: unknown) {
      setErr(getErrorMessage(e) || 'Failed');
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    try {
      setLoading(true);
      setErr(null);

      const r = await fetch('/api/2fa/sms/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code, phone }),
      });

      const j = (await r.json()) as ApiResp;
      if (!r.ok || !j?.ok) throw new Error(j?.error || 'verify failed');
      location.reload();
    } catch (e: unknown) {
      setErr(getErrorMessage(e) || 'Failed');
    } finally {
      setLoading(false);
    }
  }

  if (stage === 'idle') {
    return (
      <div className="flex items-center gap-2">
        <input
          className="h-10 rounded-xl bg-white/5 border border-white/15 px-3 outline-none focus:ring-2 focus:ring-white/20"
          placeholder={hasPhone ? 'Telefonnummer ändern' : '+49 170 1234567'}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
        />
        <button
          onClick={start}
          disabled={loading || !phone}
          className="h-10 px-3 rounded-full border border-white/15 bg-white/10 hover:bg-white/15 disabled:opacity-50"
        >
          SMS-Code anfordern
        </button>
        {err && <div className="text-sm text-red-300">{err}</div>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        className="h-10 w-28 rounded-xl bg-white/5 border border-white/15 px-3 outline-none focus:ring-2 focus:ring-white/20"
        placeholder="123456"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
      />
      <button
        onClick={verify}
        disabled={loading || code.length !== 6}
        className="h-10 px-3 rounded-full border border-white/15 bg-white/10 hover:bg-white/15 disabled:opacity-50"
      >
        Bestätigen
      </button>
      <button
        onClick={start}
        disabled={loading}
        className="h-10 px-3 rounded-full border border-white/15 bg-white/5 hover:bg-white/10"
      >
        Neu senden
      </button>
      {err && <div className="text-sm text-red-300">{err}</div>}
    </div>
  );
}
