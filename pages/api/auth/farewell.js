// pages/api/auth/farewell.js — generate an end-of-session farewell for the
// current web user. Does NOT clear the cookie. The /end-session page calls
// this, shows the result, and hits /api/auth/signout when the user is ready.

import { getOrCreateWebUser } from '../../../lib/firebase.js';
import { getSessionId } from '../../../lib/web-session.js';
import { generateFarewell, fallbackFarewell, sessionStats } from '../../../lib/farewell.js';

export default async function handler(req, res) {
  const sessionId = getSessionId(req);
  if (!sessionId) return res.status(401).json({ ok: false, error: 'No active session' });

  const user = await getOrCreateWebUser(sessionId);
  if (!user) return res.status(401).json({ ok: false, error: 'No user for this session' });

  let farewell = await generateFarewell(user);
  if (!farewell) farewell = fallbackFarewell(user);

  return res.status(200).json({
    ok:        true,
    farewell,
    stats:     sessionStats(user),
    user: {
      full_name:          user.full_name || '',
      avatar_url:         user.avatar_url || null,
      has_account:        !!user.email,
      preferred_language: user.preferred_language || 'en',
    },
  });
}
