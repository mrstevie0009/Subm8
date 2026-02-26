//src/lib/mailer.ts
import { Resend, type CreateEmailOptions } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendMail({
  to,
  subject,
  text,
  html,
  from = process.env.MAIL_FROM ?? 'Subm8 <noreply@subm8.com>',
}: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}) {
  // Dev-Fallback (lokal ohne API-Key)
  if (!process.env.RESEND_API_KEY) {
    console.log('[DEV MAIL] →', { to, subject, text, html });
    return { messageId: 'dev-mail' };
  }

  try {
    // 🔹 wir nehmen nur die Felder, die auch im Union-Typ gültig sind
    const payload: Omit<CreateEmailOptions, 'react' | 'template'> = {
      from,
      to,
      subject,
      text,
      html,
    };

    const { data, error } = await resend.emails.send(payload as CreateEmailOptions);

    if (error) throw error;
    return { messageId: data?.id ?? 'unknown' };
  } catch (err) {
    console.error('[mailer] Resend sendMail failed:', err);
    throw err;
  }
}
