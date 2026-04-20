// pages/api/cron/daily-tasks.js — delivers today's task to every active user.

import { db } from '../../../lib/firebase.js';
import { deliverTaskToUser } from '../../../lib/tasks.js';

export default async function handler(req, res) {
  if (!authorized(req)) return res.status(401).json({ ok: false });

  const snap = await db()
    .collection('coach_users')
    .where('status', '==', 'active')
    .get();

  const today = new Date().toISOString().slice(0, 10);
  const results = { sent: 0, skipped: 0, errors: 0 };

  for (const doc of snap.docs) {
    const user = { id: doc.id, ...doc.data() };
    if (user.last_task_date === today) {
      results.skipped += 1;
      continue;
    }
    try {
      const out = await deliverTaskToUser(user);
      if (out.ok) results.sent += 1;
      else results.skipped += 1;
    } catch (err) {
      console.error('[cron/daily-tasks]', user.id, err);
      results.errors += 1;
    }
  }

  return res.status(200).json({ ok: true, ...results });
}

function authorized(req) {
  const header = req.headers['authorization'];
  // Vercel Cron sets Authorization: Bearer <CRON_SECRET>
  if (header && header === `Bearer ${process.env.CRON_SECRET}`) return true;
  if (req.query.secret && req.query.secret === process.env.CRON_SECRET) return true;
  return false;
}
