// src/lib/code.ts
import crypto from 'crypto';

export function gen6() {
  // 000000–999999, mit führenden Nullen
  const n = crypto.randomInt(0, 1000000);
  return n.toString().padStart(6, '0');
}
export function sha256(s: string) {
  return crypto.createHash('sha256').update(s).digest('hex');
}
