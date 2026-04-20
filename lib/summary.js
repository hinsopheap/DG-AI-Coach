// lib/summary.js — weekly summary generation.

import {
  db,
  listSubmissionsForUser,
  createWeeklySummary,
  getTask,
  getPath,
  logActivity,
} from './firebase.js';
import { sendMessage } from './telegram.js';
import { generateWeeklySummary } from './claude.js';

function weekStart(now = new Date()) {
  const d = new Date(now);
  const day = d.getDay(); // 0 = Sunday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday as start
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export async function buildAndSendSummaryForUser(user) {
  if (user.status !== 'active') return { ok: false, reason: 'inactive' };

  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const allSubs = await listSubmissionsForUser(user.id, { limit: 50 });
  const subs = allSubs.filter(s => {
    const t = s.created_at?.toDate?.() || new Date(s.created_at || 0);
    return t >= weekAgo;
  });

  // Decorate with task titles (best-effort)
  for (const s of subs) {
    if (s.task_id) {
      const t = await getTask(s.task_id);
      s.task_title = t?.title;
    }
  }

  const path = user.learning_path_id ? await getPath(user.learning_path_id) : null;
  const completionRate = Math.min(subs.length / 5, 1); // target: 5 tasks per week

  const body = await generateWeeklySummary({
    user,
    submissions:    subs,
    completionRate,
    pathTitle:      path?.title,
  });

  // Best-effort parse of STRENGTHS / GAPS / NEXT FOCUS
  const strengths = /STRENGTHS:\s*([\s\S]*?)(?=GAPS:|NEXT FOCUS:|$)/i.exec(body)?.[1]?.trim() || '';
  const gaps = /GAPS:\s*([\s\S]*?)(?=NEXT FOCUS:|$)/i.exec(body)?.[1]?.trim() || '';
  const next = /NEXT FOCUS:\s*([\s\S]*)/i.exec(body)?.[1]?.trim() || '';

  await createWeeklySummary({
    user_id:         user.id,
    week_start_date: weekStart(),
    completion_rate: completionRate,
    strengths_text:  strengths,
    gaps_text:       gaps,
    next_focus_text: next,
  });

  await sendMessage(
    user.telegram_id,
    `🗓️ *Your weekly reflection*\n\n${body}`,
  );
  await logActivity(user.id, 'weekly_summary_sent');

  return { ok: true };
}

export async function listActiveUsers() {
  const snap = await db()
    .collection('coach_users')
    .where('status', '==', 'active')
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
