// src/lib/config.ts
export function maxUploadMB(defaultMB = 5): number {
  const v = process.env.NEXT_MAX_UPLOAD_MB;
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : defaultMB;
}

export function postsPerMinute(defaultN = 5): number {
  const v = process.env.NEXT_POSTS_PER_MIN;
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : defaultN;
}

export function rateIntervalMs(defaultMs = 60_000): number {
  const v = process.env.NEXT_RATE_INTERVAL_MS;
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : defaultMs;
}
