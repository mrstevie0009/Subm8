// src/lib/ip.ts
import { headers } from 'next/headers';

/**
 * Ermittelt die Client-IP möglichst spoofing-sicher.
 *
 * WICHTIG: `x-forwarded-for` ist client-kontrolliert. Ein Angreifer kann
 * `X-Forwarded-For: 1.2.3.4` setzen und pro Request rotieren. Deshalb dürfen
 * wir NICHT einfach das linke (erste) Element vertrauen.
 *
 * Strategie:
 *  1. Plattform-Header bevorzugen, die Proxy/Edge setzt (Vercel:
 *     `x-vercel-forwarded-for`, Cloudflare: `cf-connecting-ip`) – der Client
 *     kann sie nicht überschreiben.
 *  2. Fallback: das RECHTE Element von `x-forwarded-for` (Hop am nächsten zum
 *     vertrauenswürdigen Proxy). Korrekt bei genau einem Proxy davor (Vercel/CF).
 *
 * Bei mehreren eigenen Proxies TRUSTED_PROXY_HOPS via ENV anpassen.
 */
const TRUSTED_PROXY_HOPS = Number(process.env.TRUSTED_PROXY_HOPS || 1);

function pickFromXff(xff: string): string | null {
  const parts = xff.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const idx = Math.max(0, parts.length - TRUSTED_PROXY_HOPS);
  return parts[idx] ?? parts[parts.length - 1] ?? null;
}

export async function getClientIp(): Promise<string> {
  try {
    const h = await headers();

    // 1) Plattform-Header (nicht client-spoofbar)
    const cf = h.get('cf-connecting-ip');
    if (cf) return cf.trim();

    const vercel = h.get('x-vercel-forwarded-for');
    if (vercel) return (vercel.split(',')[0] || '').trim() || '0.0.0.0';

    // 2) Fallback: rechtes (vertrauenswürdiges) Element aus x-forwarded-for
    const fromXff = pickFromXff(h.get('x-forwarded-for') || '');
    if (fromXff) return fromXff;

    // 3) letzter Fallback
    const real = h.get('x-real-ip') || '';
    return real.trim() || '0.0.0.0';
  } catch {
    return '0.0.0.0';
  }
}