// src/lib/sms.ts
type SmsArgs = { to: string; body: string };

type ProviderResult =
  | { ok: true; provider: 'vonage' }
  | { ok: true; dev: true }; // DEV-Logging

// Vonage Minimal-Response (nur was wir lesen)
type VonageResponse = {
  messages?: Array<{
    status?: string;
    ['message-id']?: string;
    ['error-text']?: string;
  }>;
};

// Optional: kleine Normalisierung auf E.164, wenn '+' fehlt.
function toE164(num: string) {
  const n = num.trim();
  if (n.startsWith('+')) return n;
  // hier KEINE harte Landeslogik: erwarte bereits +CC
  return n;
}

async function sendWithVonage(to: string, body: string): Promise<ProviderResult> {
  const { VONAGE_API_KEY, VONAGE_API_SECRET, SMS_FROM } = process.env;
  if (!VONAGE_API_KEY || !VONAGE_API_SECRET || !SMS_FROM) {
    throw new Error('Vonage env missing');
  }

  const res = await fetch('https://rest.nexmo.com/sms/json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      api_key: VONAGE_API_KEY,
      api_secret: VONAGE_API_SECRET,
      to,
      from: SMS_FROM,
      text: body,
      type: 'text',
    }).toString(),
  });

  if (!res.ok) {
    throw new Error(`vonage_${res.status}`);
  }

  const json = (await res.json().catch(() => ({}))) as VonageResponse;
  const msg = json?.messages?.[0];

  if (msg?.status && msg.status !== '0') {
    // Vonage-Spezifischer Fehlercode
    throw new Error(`vonage_code_${msg.status}${msg['error-text'] ? `:${msg['error-text']}` : ''}`);
  }

  return { ok: true, provider: 'vonage' };
}

/**
 * Schlanke Version:
 * - Wenn DEV_SMS_LOG=true → nur loggen, nichts senden
 * - Sonst IMMER Vonage verwenden
 */
export async function sendSms({ to, body }: SmsArgs): Promise<ProviderResult> {
  const { DEV_SMS_LOG } = process.env;

  const normalizedTo = toE164(to);

  // Dev/Preview: nur loggen
  if (DEV_SMS_LOG === 'true') {
    console.log('[DEV SMS]', { to: normalizedTo, body });
    return { ok: true, dev: true };
  }

  return await sendWithVonage(normalizedTo, body);
}
