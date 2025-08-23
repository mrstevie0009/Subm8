// src/lib/rateLimit.ts

type Bucket = {
  tokens: number;       // aktuelle Tokenzahl
  last: number;         // letzter Refill-Zeitpunkt (ms)
  capacity: number;     // Max Tokens
  refillPerMs: number;  // Tokens pro ms
};

type Decision = {
  ok: true;
  remaining: number;        // verbleibende Tokens (gerundet)
} | {
  ok: false;
  retryAfterMs: number;     // empfohlene Wartezeit bis zum nächsten Token
};

const GLOBAL_STORE_KEY = '__subm8_rate_limit_store__';
const store: Map<string, Bucket> =
  // @ts-ignore
  (globalThis[GLOBAL_STORE_KEY] ?? (globalThis[GLOBAL_STORE_KEY] = new Map()));

function getOrCreateBucket(key: string, capacity: number, intervalMs: number): Bucket {
  let b = store.get(key);
  if (!b) {
    b = {
      tokens: capacity,
      last: Date.now(),
      capacity,
      refillPerMs: capacity / Math.max(1, intervalMs),
    };
    store.set(key, b);
  }
  return b;
}

/**
 * Nimmt 1 Token aus dem Bucket des Keys.
 * @param key Eindeutiger Schlüssel (z.B. `post:${userId}`)
 * @param capacity Max Tokens (z.B. 5)
 * @param intervalMs Zeitraum für volle Auffüllung (z.B. 60000 ms)
 */
export function takeToken(key: string, capacity: number, intervalMs: number): Decision {
  const now = Date.now();
  const b = getOrCreateBucket(key, capacity, intervalMs);

  // Nachfüllen
  const elapsed = now - b.last;
  if (elapsed > 0) {
    b.tokens = Math.min(b.capacity, b.tokens + elapsed * b.refillPerMs);
    b.last = now;
  }

  if (b.tokens >= 1) {
    b.tokens -= 1;
    return { ok: true, remaining: Math.floor(b.tokens) };
  }

  // Zeit bis zum nächsten ganzen Token
  const needed = 1 - b.tokens;
  const retryAfterMs = Math.ceil(needed / b.refillPerMs);
  return { ok: false, retryAfterMs };
}
