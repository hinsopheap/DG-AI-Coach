// lib/rate-limit.js — minimal in-memory IP rate limiter for serverless.
//
// Vercel functions are short-lived, so in-memory is per-instance. This
// catches abuse at the instance level (which is enough for our pilot
// scale) without needing Redis. Upgrade to Upstash Rate Limit when we
// outgrow it.

const buckets = new Map();
const SWEEP_AFTER = 60_000;
let lastSweep = Date.now();

function sweep(now) {
  if (now - lastSweep < SWEEP_AFTER) return;
  for (const [key, bucket] of buckets.entries()) {
    if (now - bucket.resetAt > 0) buckets.delete(key);
  }
  lastSweep = now;
}

export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

// Allow `limit` requests per `windowMs`. Returns true if the request is
// allowed (and counted), false if it should be rejected.
export function takeToken(key, { limit = 30, windowMs = 60_000 } = {}) {
  const now = Date.now();
  sweep(now);

  let bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  if (bucket.count >= limit) return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  bucket.count += 1;
  return { ok: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}

// Express-style helper. If rate-limited, writes the 429 response and
// returns true (caller should `return` immediately).
export function rateLimit(req, res, opts = {}) {
  const ip = clientIp(req);
  const key = `${opts.scope || 'default'}:${ip}`;
  const result = takeToken(key, opts);
  if (!result.ok) {
    res.setHeader('Retry-After', String(result.retryAfter));
    res.status(429).json({ ok: false, error: 'Too many requests. Slow down a touch.' });
    return true; // "rate limited"
  }
  return false; // "ok to proceed"
}
