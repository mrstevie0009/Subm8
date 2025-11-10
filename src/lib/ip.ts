// src/lib/ip.ts
import { headers } from 'next/headers';

export async function getClientIp(): Promise<string> {
  try {
    const h = await headers(); // in manchen Setups async typisiert
    const xff = h.get('x-forwarded-for') || '';
    const real = h.get('x-real-ip') || '';
    const ip = (xff.split(',')[0] || real || '').trim();
    return ip || '0.0.0.0';
  } catch {
    return '0.0.0.0';
  }
}
