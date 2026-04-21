import {
  findUserByEmail,
  verifyPassword,
  normalizeEmail,
  rotateSession,
} from '../../../lib/user-auth.js';
import { sessionCookie } from '../../../lib/web-session.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');
  if (!email || !password) return res.status(400).json({ ok: false, error: 'Email and password required.' });

  const user = await findUserByEmail(email);
  if (!user) return res.status(401).json({ ok: false, error: 'No account with that email — try signing up.' });

  const match = await verifyPassword(password, user.password_hash);
  if (!match) return res.status(401).json({ ok: false, error: 'Wrong password.' });

  const token = await rotateSession(user.id);
  res.setHeader('Set-Cookie', sessionCookie(token));
  return res.status(200).json({ ok: true });
}
