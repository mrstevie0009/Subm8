// src/lib/mailer.ts
import nodemailer, {
  type Transporter,
  type SendMailOptions,
  type SentMessageInfo,
} from 'nodemailer';

type SendArgs = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
};

/** Gemeinsames Interface für echten Transport und Dev-Fallback */
type MailSender = {
  sendMail: (mail: SendMailOptions) => Promise<SentMessageInfo | { messageId: string }>;
  verify?: () => Promise<void>;
};

let transporter: MailSender | null = null;

function boolFromEnv(value: string | undefined, defaultValue = false): boolean {
  if (value == null) return defaultValue;
  const v = String(value).trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function getTransporter(): MailSender {
  if (transporter) return transporter;

  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_SECURE,
    SMTP_FROM,
  } = process.env;

  // DEV-Fallback: wenn notwendige SMTP-Infos fehlen, nur in die Konsole "senden"
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_FROM) {
    const devTransporter: MailSender = {
      async sendMail(opts: SendMailOptions) {
        // Nur für lokale Entwicklung/Tests gedacht.
        // In Production sollte dieser Pfad NIEMALS aktiv sein.
        console.log('[DEV MAIL] →', {
          from: opts.from,
          to: opts.to,
          subject: opts.subject,
          text: opts.text,
          html: opts.html,
        });
        return { messageId: 'dev-mail' };
      },
    };
    transporter = devTransporter;
    return devTransporter;
  }

  const secure = boolFromEnv(SMTP_SECURE, false);
  const port = Number(SMTP_PORT);

  const realTransport = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure,
    auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  }) as Transporter & MailSender;

  transporter = realTransport;

  // Verbindungscheck optional – schlägt bei falschen Credentials schnell an.
  // Nicht hart fehlschlagen lassen (API fängt selbst ab).
  realTransport.verify?.().catch((err: unknown) => {
    console.warn('[mailer] transporter verify failed:', err);
  });

  return realTransport;
}

export async function sendMail({ to, subject, text, html, from }: SendArgs) {
  const t = getTransporter();
  const fromAddr = from ?? process.env.SMTP_FROM ?? 'no-reply@example.com';

  return t.sendMail({
    from: fromAddr,
    to,
    subject,
    text,
    html,
  });
}
