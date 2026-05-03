import { getOrCreateWebUser } from '../../../lib/firebase.js';
import { getSessionId } from '../../../lib/web-session.js';
import { leaveOrg } from '../../../lib/org.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const sessionId = getSessionId(req);
  if (!sessionId) return res.status(401).json({ ok: false, error: 'No session' });

  const user = await getOrCreateWebUser(sessionId);
  if (!user || !user.org_id) return res.status(400).json({ ok: false, error: 'Not in a team' });

  await leaveOrg(user.id);
  return res.status(200).json({ ok: true });
}
