// pages/api/chat/pairing-code.js — generate a Web→Telegram pairing code.
// The web user calls this; the returned code is then typed in @dgaicoach_bot
// as `/link CODE` to attach the Telegram identity to this web account.

import { getOrCreateWebUser, createWebPairingCode } from '../../../lib/firebase.js';
import { getSessionId, newSessionId, sessionCookie } from '../../../lib/web-session.js';
import { rateLimit } from '../../../lib/rate-limit.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  if (rateLimit(req, res, { scope: 'pairing', limit: 5, windowMs: 5 * 60_000 })) return;

  let sessionId = getSessionId(req);
  if (!sessionId) {
    sessionId = newSessionId();
    res.setHeader('Set-Cookie', sessionCookie(sessionId));
  }

  const user = await getOrCreateWebUser(sessionId);
  const code = await createWebPairingCode(user.id);

  return res.status(200).json({
    ok:   true,
    code,
    bot:  '@dgaicoach_bot',
    instructions: `Open @dgaicoach_bot in Telegram and send /link ${code}. Code expires in 15 minutes.`,
  });
}
