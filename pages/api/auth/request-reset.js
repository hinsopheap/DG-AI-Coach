import { requestReset } from '../../../lib/password-reset.js';
import { rateLimit } from '../../../lib/rate-limit.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  if (rateLimit(req, res, { scope: 'reset', limit: 5, windowMs: 10 * 60_000 })) return;

  const email = String(req.body?.email || '').trim();
  if (!email || !email.includes('@')) {
    return res.status(400).json({ ok: false, error: 'Enter a valid email.' });
  }

  const baseUrl = process.env.PUBLIC_BASE_URL || `https://${req.headers.host}`;
  const result = await requestReset(email, baseUrl);

  // Don't leak which emails exist — return a uniform message except for the
  // "no Telegram linked" case, where we have to tell the user the only path
  // forward (link Telegram or email admin).
  if (result.ok) {
    return res.status(200).json({ ok: true, message: 'Check your Telegram for a reset link.' });
  }
  if (result.reason === 'no_telegram') {
    return res.status(400).json({
      ok: false,
      error: "This account isn't linked to Telegram. Email sopheap.hin@gmail.com to reset, or link Telegram first by signing in and running /web in the bot.",
    });
  }
  // For 'no_account' return success-shaped message to avoid email enumeration
  return res.status(200).json({ ok: true, message: 'If that email is registered and linked to Telegram, a reset link was sent.' });
}
