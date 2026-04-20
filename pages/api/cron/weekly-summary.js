// pages/api/cron/weekly-summary.js — generates and sends weekly reflections.

import { listActiveUsers, buildAndSendSummaryForUser } from '../../../lib/summary.js';

export default async function handler(req, res) {
  const header = req.headers['authorization'];
  const authed =
    (header && header === `Bearer ${process.env.CRON_SECRET}`) ||
    (req.query.secret && req.query.secret === process.env.CRON_SECRET);
  if (!authed) return res.status(401).json({ ok: false });

  const users = await listActiveUsers();
  const results = { sent: 0, errors: 0 };

  for (const user of users) {
    try {
      const out = await buildAndSendSummaryForUser(user);
      if (out.ok) results.sent += 1;
    } catch (err) {
      console.error('[cron/weekly-summary]', user.id, err);
      results.errors += 1;
    }
  }

  return res.status(200).json({ ok: true, users: users.length, ...results });
}
