import { consumeResetToken } from '../../../lib/password-reset.js';
import { sessionCookie } from '../../../lib/web-session.js';
import { rateLimit } from '../../../lib/rate-limit.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  if (rateLimit(req, res, { scope: 'reset-consume', limit: 10, windowMs: 10 * 60_000 })) return;

  const token = String(req.body?.token || '');
  const password = String(req.body?.password || '');

  const result = await consumeResetToken(token, password);
  if (!result.ok) return res.status(400).json(result);

  // Sign the user in immediately on the new session
  res.setHeader('Set-Cookie', sessionCookie(result.session_token));
  return res.status(200).json({ ok: true });
}
