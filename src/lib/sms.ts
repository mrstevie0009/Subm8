type SmsArgs = { to: string; body: string };

export async function sendSms({ to, body }: SmsArgs) {
  const { SMS_PROVIDER, TWILIO_SID, TWILIO_TOKEN, SMS_FROM, DEV_SMS_LOG } = process.env;

  // Dev/Preview: nur loggen
  if (DEV_SMS_LOG === 'true' || !SMS_PROVIDER) {
    console.log('[DEV SMS]', { to, body });
    return { ok: true };
  }

  if (SMS_PROVIDER === 'twilio') {
    const sid = TWILIO_SID ?? '';
    const token = TWILIO_TOKEN ?? '';
    if (!sid || !token || !SMS_FROM) throw new Error('SMS env missing');

    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: SMS_FROM, To: to, Body: body }).toString(),
    });

    if (!res.ok) throw new Error(`Twilio ${res.status}`);
    return { ok: true };
  }

  throw new Error('Unsupported SMS_PROVIDER');
}
