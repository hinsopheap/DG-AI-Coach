import { getOrCreateWebUser } from '../../../lib/firebase.js';
import { getSessionId } from '../../../lib/web-session.js';
import { createOrg } from '../../../lib/org.js';
import { rateLimit } from '../../../lib/rate-limit.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  if (rateLimit(req, res, { scope: 'org-create', limit: 3, windowMs: 60 * 60_000 })) return;

  const sessionId = getSessionId(req);
  if (!sessionId) return res.status(401).json({ ok: false, error: 'No session' });

  const user = await getOrCreateWebUser(sessionId);
  if (!user) return res.status(401).json({ ok: false, error: 'No user' });
  if (user.org_id) return res.status(400).json({ ok: false, error: 'Already in a team — leave it first.' });

  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ ok: false, error: 'Team name required' });

  try {
    const org = await createOrg({ name, owner_id: user.id });
    return res.status(200).json({ ok: true, org });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
