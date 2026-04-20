// pages/api/chat/profile.js — update editable profile fields from the web.

import { getOrCreateWebUser, updateUser } from '../../../lib/firebase.js';
import { getSessionId, newSessionId, sessionCookie } from '../../../lib/web-session.js';

const ALLOWED_ROLES = ['ceo', 'gm', 'senior_manager', 'team_leader', 'professional'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  let sessionId = getSessionId(req);
  if (!sessionId) {
    sessionId = newSessionId();
    res.setHeader('Set-Cookie', sessionCookie(sessionId));
  }

  const user = await getOrCreateWebUser(sessionId);

  const patch = {};
  if (typeof req.body?.full_name === 'string' && req.body.full_name.trim()) {
    patch.full_name = req.body.full_name.trim().slice(0, 80);
  }
  if (typeof req.body?.role === 'string' && ALLOWED_ROLES.includes(req.body.role)) {
    patch.role = req.body.role;
  }
  if (typeof req.body?.goal === 'string') {
    patch.goal = req.body.goal.trim().slice(0, 300);
  }
  if (typeof req.body?.preferred_language === 'string' && ['en', 'km'].includes(req.body.preferred_language)) {
    patch.preferred_language = req.body.preferred_language;
  }

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ ok: false, error: 'No valid fields to update' });
  }

  await updateUser(user.id, patch);
  return res.status(200).json({ ok: true, patch });
}
