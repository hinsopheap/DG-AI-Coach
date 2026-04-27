import {
  findUserByEmail,
  createUserWithEmail,
  upgradeAnonToAccount,
  hashPassword,
  normalizeEmail,
  rotateSession,
  newAuthToken,
} from '../../../lib/user-auth.js';
import { getOrCreateWebUser } from '../../../lib/firebase.js';
import { getSessionId, sessionCookie } from '../../../lib/web-session.js';
import { rateLimit } from '../../../lib/rate-limit.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  // 5 signups per 5 minutes per IP — hostile to abuse, fine for real humans.
  if (rateLimit(req, res, { scope: 'signup', limit: 5, windowMs: 5 * 60_000 })) return;

  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');
  const fullName = String(req.body?.full_name || '').trim();

  if (!email || !email.includes('@')) return res.status(400).json({ ok: false, error: 'Enter a valid email.' });
  if (password.length < 8)            return res.status(400).json({ ok: false, error: 'Password must be at least 8 characters.' });
  if (!fullName)                      return res.status(400).json({ ok: false, error: 'Please tell us your name.' });

  const existing = await findUserByEmail(email);
  if (existing) return res.status(409).json({ ok: false, error: 'An account with that email already exists. Try signing in.' });

  const password_hash = await hashPassword(password);

  // If the visitor already has an anonymous web user (cookie set), upgrade it
  // rather than orphaning their existing messages/progress.
  let userId;
  let sessionId = getSessionId(req);
  if (sessionId) {
    const anon = await getOrCreateWebUser(sessionId);
    if (anon && (anon.telegram_id || '').startsWith('web_')) {
      await upgradeAnonToAccount(anon.id, { email, password_hash, full_name: fullName });
      userId = anon.id;
    }
  }

  if (!userId) {
    sessionId = newAuthToken();
    const user = await createUserWithEmail({
      email,
      password_hash,
      full_name: fullName,
      web_session_id: sessionId,
    });
    userId = user.id;
  } else {
    // Rotate session on upgrade for hygiene
    sessionId = await rotateSession(userId);
  }

  res.setHeader('Set-Cookie', sessionCookie(sessionId));
  return res.status(200).json({ ok: true, user_id: userId });
}
