// pages/api/chat/dashboard.js — serve the learner's dashboard snapshot for
// the logged-in web session.

import {
  getOrCreateWebUser,
  listSubmissionsForUser,
  listTasksForPath,
  getPath,
  getTask,
} from '../../../lib/firebase.js';
import { getSessionId, newSessionId, sessionCookie } from '../../../lib/web-session.js';
import { dashboardSnapshot, ACHIEVEMENTS } from '../../../lib/gamification.js';

export default async function handler(req, res) {
  let sessionId = getSessionId(req);
  if (!sessionId) {
    sessionId = newSessionId();
    res.setHeader('Set-Cookie', sessionCookie(sessionId));
  }

  const user = await getOrCreateWebUser(sessionId);
  const [submissions, path] = await Promise.all([
    listSubmissionsForUser(user.id, { limit: 100 }),
    user.learning_path_id ? getPath(user.learning_path_id) : null,
  ]);

  const tasks = user.learning_path_id ? await listTasksForPath(user.learning_path_id) : [];
  const doneIds = new Set(submissions.map(s => s.task_id));

  // Decorate submissions with task title for the timeline
  for (const s of submissions) {
    if (s.task_id && !s.task_title) {
      const t = await getTask(s.task_id);
      s.task_title = t?.title;
    }
  }

  const scores = submissions.map(s => s.total_score).filter(n => typeof n === 'number');
  const avg = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10
    : null;

  const snap = dashboardSnapshot(user);

  // Build the full achievements catalog so the UI can show locked ones too.
  const catalog = Object.entries(ACHIEVEMENTS).map(([code, meta]) => ({
    code,
    icon: meta.icon,
    title: meta.title,
    desc: meta.desc,
    xp: meta.xp,
    unlocked: (user.achievements || []).includes(code),
  }));

  return res.status(200).json({
    ok: true,
    user: {
      id:                user.id,
      full_name:         user.full_name || '',
      role:              user.role || '',
      goal:              user.goal || '',
      preferred_language:user.preferred_language || 'en',
      avatar_url:        user.avatar_url || null,
      paired_telegram:   user.telegram_id && !user.telegram_id.startsWith('web_'),
    },
    path: path ? { id: path.id, title: path.title, description: path.description || '' } : null,
    stats: {
      tasks_completed:  submissions.length,
      tasks_total:      tasks.length,
      average_score:    avg,
      streak:           snap.streak_count,
    },
    xp: {
      total:       snap.xp,
      level:       snap.level,
      level_name:  snap.level_name,
      floor:       snap.level_floor,
      ceil:        snap.level_ceil,
      to_next:     snap.level_to_next,
      progress:    snap.progress,
    },
    achievements: {
      unlocked_count: snap.unlocked_count,
      total:          snap.total_achievements,
      catalog,
    },
    awards: snap.awards.slice(0, 12),
    tasks: tasks.map(t => ({
      id:             t.id,
      title:          t.title,
      sequence_order: t.sequence_order,
      done:           doneIds.has(t.id),
    })),
    recent_submissions: submissions.slice(0, 8).map(s => ({
      task_id:     s.task_id,
      task_title:  s.task_title,
      total_score: s.total_score,
      feedback:    (s.feedback_text || '').slice(0, 200),
      created_at:  s.created_at?.toDate?.().toISOString() || null,
    })),
  });
}
