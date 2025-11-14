// src/lib/sms.ts
type SmsArgs = { to: string; body: string };
type ProviderResult =
  | { ok: true; provider: 'twilio' | 'telnyx' | 'vonage' | 'messagebird' | 'plivo' }
  | { ok: true; dev: true }; // DEV-Logging

// Vonage Minimal-Response (nur was wir lesen)
type VonageResponse = {
  messages?: Array<{ status?: string; ['message-id']?: string; ['error-text']?: string }>;
};

// Optional: kleine Normalisierung auf E.164, wenn '+' fehlt.
function toE164(num: string) {
  const n = num.trim();
  if (n.startsWith('+')) return n;
  // hier KEINE harte Landeslogik: erwarte bereits +CC
  return n;
}

async function sendWithTwilio(to: string, body: string): Promise<ProviderResult> {
  const { TWILIO_SID, TWILIO_TOKEN, SMS_FROM } = process.env;
  if (!TWILIO_SID || !TWILIO_TOKEN || !SMS_FROM) throw new Error('Twilio env missing');

  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
  const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ From: SMS_FROM, To: to, Body: body }).toString(),
  });
  if (!res.ok) throw new Error(`twilio_${res.status}`);
  return { ok: true, provider: 'twilio' };
}

async function sendWithTelnyx(to: string, body: string): Promise<ProviderResult> {
  const { TELNYX_API_KEY, TELNYX_MESSAGING_PROFILE_ID, SMS_FROM } = process.env;
  if (!TELNYX_API_KEY || !TELNYX_MESSAGING_PROFILE_ID) throw new Error('Telnyx env missing');

  const res = await fetch('https://api.telnyx.com/v2/messages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TELNYX_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_profile_id: TELNYX_MESSAGING_PROFILE_ID,
      // from optional – wenn gesetzt, muss gültige Nummer oder registrierter Alpha-Sender sein
      ...(SMS_FROM ? { from: SMS_FROM } : {}),
      to,
      text: body,
    }),
  });

  const json = await res.json().catch(() => null);
  console.log('[Telnyx raw]', res.status, JSON.stringify(json));
  if (!res.ok) {
    const detail =
      (json)?.errors?.[0]?.detail ||
      (json)?.errors?.[0]?.title ||
      '';
    throw new Error(`telnyx_${res.status}:${detail}`);
  }
  return { ok: true, provider: 'telnyx' };
}

async function sendWithVonage(to: string, body: string): Promise<ProviderResult> {
  const { VONAGE_API_KEY, VONAGE_API_SECRET, SMS_FROM } = process.env;
  if (!VONAGE_API_KEY || !VONAGE_API_SECRET || !SMS_FROM) throw new Error('Vonage env missing');

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
  if (!res.ok) throw new Error(`vonage_${res.status}`);
  const json = (await res.json().catch(() => ({}))) as VonageResponse;
  const msg = json?.messages?.[0];
  if (msg?.status && msg.status !== '0') {
    throw new Error(`vonage_code_${msg.status}`);
  }
  return { ok: true, provider: 'vonage' };
}

async function sendWithMessageBird(to: string, body: string): Promise<ProviderResult> {
  const { MESSAGEBIRD_API_KEY, SMS_FROM } = process.env;
  if (!MESSAGEBIRD_API_KEY || !SMS_FROM) throw new Error('MessageBird env missing');

  const res = await fetch('https://rest.messagebird.com/messages', {
    method: 'POST',
    headers: {
      Authorization: `AccessKey ${MESSAGEBIRD_API_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      recipients: to,
      originator: SMS_FROM,
      body,
    }).toString(),
  });
  if (!res.ok) throw new Error(`messagebird_${res.status}`);
  return { ok: true, provider: 'messagebird' };
}

async function sendWithPlivo(to: string, body: string): Promise<ProviderResult> {
  const { PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN, SMS_FROM } = process.env;
  if (!PLIVO_AUTH_ID || !PLIVO_AUTH_TOKEN || !SMS_FROM) throw new Error('Plivo env missing');

  const url = `https://api.plivo.com/v1/Account/${PLIVO_AUTH_ID}/Message/`;
  const auth = Buffer.from(`${PLIVO_AUTH_ID}:${PLIVO_AUTH_TOKEN}`).toString('base64');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ src: SMS_FROM, dst: to, text: body }),
  });
  if (!res.ok) throw new Error(`plivo_${res.status}`);
  return { ok: true, provider: 'plivo' };
}

function parseList(env?: string) {
  return (env ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Primärer Sender – nutzt SMS_PROVIDER und optional SMS_FALLBACKS (Komma-getrennt).
 * DEV-Szenario: Wenn DEV_SMS_LOG=true oder kein Provider gesetzt, nur loggen.
 */
export async function sendSms({ to, body }: SmsArgs): Promise<ProviderResult> {
  const { DEV_SMS_LOG, SMS_PROVIDER, SMS_FALLBACKS } = process.env;

  const normalizedTo = toE164(to);

  // Dev/Preview: nur loggen
  if (DEV_SMS_LOG === 'true' || !SMS_PROVIDER) {
    console.log('[DEV SMS]', { to: normalizedTo, body });
    return { ok: true, dev: true };
  }

  const providers = [SMS_PROVIDER.toLowerCase(), ...parseList(SMS_FALLBACKS)];
  const errors: string[] = [];

  for (const p of providers) {
    try {
      switch (p) {
        case 'twilio':
          return await sendWithTwilio(normalizedTo, body);
        case 'telnyx':
          return await sendWithTelnyx(normalizedTo, body);
        case 'vonage':
          return await sendWithVonage(normalizedTo, body);
        case 'messagebird':
          return await sendWithMessageBird(normalizedTo, body);
        case 'plivo':
          return await sendWithPlivo(normalizedTo, body);
        default:
          errors.push(`unsupported_${p}`);
          break;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[SMS ${p} failed]`, msg);
      errors.push(`${p}:${msg}`);
      // weiter zum nächsten Provider
    }
  }

  throw new Error(`All SMS providers failed: ${errors.join(' | ')}`);
}
