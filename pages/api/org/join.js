import { getOrCreateWebUser } from '../../../lib/firebase.js';
import { getSessionId } from '../../../lib/web-session.js';
import { joinOrgByCode } from '../../../lib/org.js';
import { rateLimit } from '../../../lib/rate-limit.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  if (rateLimit(req, res, { scope: 'org-join', limit: 5, windowMs: 60 * 60_000 })) return;

  const sessionId = getSessionId(req);
  if (!sessionId) return res.status(401).json({ ok: false, error: 'No session' });

  const user = await getOrCreateWebUser(sessionId);
  if (!user) return res.status(401).json({ ok: false, error: 'No user' });

  const code = String(req.body?.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ ok: false, error: 'Code required' });

  const result = await joinOrgByCode(user.id, code);
  if (!result.ok) return res.status(400).json({ ok: false, error: 'Invalid team code' });

  return res.status(200).json({ ok: true, org: result.org });
}
