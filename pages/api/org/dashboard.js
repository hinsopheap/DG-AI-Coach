import { getOrCreateWebUser } from '../../../lib/firebase.js';
import { getSessionId } from '../../../lib/web-session.js';
import { orgDashboard, getOrg } from '../../../lib/org.js';

export default async function handler(req, res) {
  const sessionId = getSessionId(req);
  if (!sessionId) return res.status(401).json({ ok: false });

  const user = await getOrCreateWebUser(sessionId);
  if (!user) return res.status(401).json({ ok: false });

  if (!user.org_id) {
    return res.status(200).json({ ok: true, in_org: false });
  }

  const org = await getOrg(user.org_id);
  if (!org) {
    return res.status(200).json({ ok: true, in_org: false });
  }

  const isOwner = user.id === org.owner_id;
  if (!isOwner) {
    // Members see basic info only — not the full team list (privacy)
    return res.status(200).json({
      ok: true,
      in_org: true,
      role: 'member',
      org: { id: org.id, name: org.name, invite_code: org.invite_code },
    });
  }

  // Owner sees the full dashboard
  const data = await orgDashboard(user.org_id);
  return res.status(200).json({ ok: true, in_org: true, role: 'owner', org: data });
}
