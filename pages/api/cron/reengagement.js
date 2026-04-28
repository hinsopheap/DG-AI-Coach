// pages/api/cron/reengagement.js — daily sweep that brings inactive
// learners back with a personalized hook. Telegram-linked users only.
//
// Runs at 02:00 UTC (09:00 ICT) — 1 hour after the daily-tasks cron — so
// active users get their daily task first; only true dropouts get the
// re-engagement nudge.

import { runReengagementSweep } from '../../../lib/reengagement.js';
import { logError } from '../../../lib/error-log.js';

export default async function handler(req, res) {
  const header = req.headers['authorization'];
  const authed =
    (header && header === `Bearer ${process.env.CRON_SECRET}`) ||
    (req.query.secret && req.query.secret === process.env.CRON_SECRET);
  if (!authed) return res.status(401).json({ ok: false });

  try {
    const results = await runReengagementSweep();
    return res.status(200).json({ ok: true, ...results });
  } catch (err) {
    await logError('cron_reengagement', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
