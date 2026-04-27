// pages/api/chat/report.js — learner flags a coach reply they think is wrong.

import { getOrCreateWebUser, addReport, getLatestUserMessage, logActivity } from '../../../lib/firebase.js';
import { getSessionId } from '../../../lib/web-session.js';
import { rateLimit } from '../../../lib/rate-limit.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  if (rateLimit(req, res, { scope: 'report', limit: 20, windowMs: 60_000 })) return;

  const sessionId = getSessionId(req);
  if (!sessionId) return res.status(401).json({ ok: false, error: 'No session' });

  const messageText = String(req.body?.message_text || '').trim();
  const reason      = String(req.body?.reason || '').trim();

  if (!messageText) {
    return res.status(400).json({ ok: false, error: 'No message to report' });
  }

  const user = await getOrCreateWebUser(sessionId);
  const lastUser = await getLatestUserMessage(user.id);

  await addReport({
    user_id:        user.id,
    message_text:   messageText,
    last_user_text: lastUser?.text || '',
    reason,
    surface:        'web',
  });
  await logActivity(user.id, 'reply_reported', { reason: reason.slice(0, 100) });

  return res.status(200).json({ ok: true });
}
