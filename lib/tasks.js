// lib/tasks.js — task delivery and progress helpers.

import {
  getNextTaskForUser,
  getTask,
  getRubric,
  createSubmission,
  listSubmissionsForUser,
  updateUser,
  logActivity,
  getPath,
} from './firebase.js';
import { sendMessage, sendChatAction } from './telegram.js';
import { evaluateSubmission } from './claude.js';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function formatTaskMessage(task, user) {
  const lang = user.preferred_language === 'km' ? 'km' : 'en';
  const label = lang === 'km' ? '📚 *ចម្រៀវថ្ងៃនេះ*' : '📚 *Today\'s lesson*';
  const promptLabel = lang === 'km' ? '✍️ *កិច្ចការ*' : '✍️ *Your task*';
  const hint = lang === 'km'
    ? '_សូមផ្ញើចម្លើយរបស់អ្នកជាអត្ថបទ ឬសារជាសំឡេង។_'
    : '_Reply with your answer as text (or a voice note)._';

  return `${label}\n\n*${task.title}*\n\n${task.lesson_text}\n\n${promptLabel}\n${task.prompt_text}\n\n${hint}`;
}

// Send today's task to a user (used by /today and the daily cron).
export async function deliverTaskToUser(user) {
  if (user.status !== 'active') return { ok: false, reason: 'inactive' };

  const task = await getNextTaskForUser(user);
  if (!task) {
    await sendMessage(
      user.telegram_id,
      user.preferred_language === 'km'
        ? '🎉 អ្នកបានបញ្ចប់ផ្លូវសិក្សារបស់អ្នកហើយ! ការអាប់ដេតបន្ថែមនឹងមកដល់ឆាប់ៗ។'
        : '🎉 You have completed your learning path! More content is coming soon.',
    );
    return { ok: true, reason: 'path_complete' };
  }

  await sendMessage(user.telegram_id, formatTaskMessage(task, user));
  await updateUser(user.id, { last_task_id: task.id, last_task_date: todayISO() });
  await logActivity(user.id, 'task_delivered', { task_id: task.id });
  return { ok: true, task_id: task.id };
}

// Handle a learner's submission for their current task.
export async function handleSubmission(user, chatId, submissionText) {
  if (!user.last_task_id) {
    await sendMessage(
      chatId,
      user.preferred_language === 'km'
        ? 'សូមផ្ញើ /today ដើម្បីទទួលបានកិច្ចការសិក្សារបស់អ្នកជាមុនសិន។'
        : 'Send /today first to receive your lesson and task.',
    );
    return;
  }

  const task = await getTask(user.last_task_id);
  if (!task) {
    await sendMessage(chatId, 'Your current task could not be found. Please try /today again.');
    return;
  }

  await sendChatAction(chatId, 'typing');
  const rubric = task.rubric_id ? await getRubric(task.rubric_id) : null;
  const result = await evaluateSubmission({
    task,
    rubric,
    submission: submissionText,
    role:       user.role,
    language:   user.preferred_language,
  });

  await createSubmission({
    user_id:         user.id,
    task_id:         task.id,
    submission_type: 'text',
    submission_text: submissionText,
    score_json:      result.criterion_scores,
    total_score:     result.total_score,
    feedback_text:   result.feedback,
  });

  // Update streak — if last completion was yesterday, increment; if today, keep; else reset to 1.
  const today = todayISO();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  let newStreak = 1;
  if (user.last_completion_date === today) newStreak = user.streak_count || 1;
  else if (user.last_completion_date === yesterday) newStreak = (user.streak_count || 0) + 1;
  await updateUser(user.id, {
    streak_count:         newStreak,
    last_completion_date: today,
  });

  await logActivity(user.id, 'task_submitted', {
    task_id: task.id,
    score:   result.total_score,
  });

  const scoreLine = result.total_score != null
    ? `📊 *Score:* ${result.total_score}/10`
    : '';
  const nextLine = result.next_action
    ? `➡️ *Next:* ${result.next_action}`
    : '';
  const streakLine = newStreak > 1 ? `🔥 *Streak:* ${newStreak} days` : '';

  const reply = [scoreLine, '', result.feedback, '', nextLine, streakLine]
    .filter(Boolean)
    .join('\n');

  await sendMessage(chatId, reply);
}

// Format a /progress response.
export async function formatProgress(user) {
  const subs = await listSubmissionsForUser(user.id, { limit: 30 });
  const path = user.learning_path_id ? await getPath(user.learning_path_id) : null;
  const scores = subs.map(s => s.total_score).filter(s => typeof s === 'number');
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10 : 'n/a';

  return `📈 *Your progress*
Path: ${path?.title || '—'}
Tasks completed: ${subs.length}
Average score: ${avg}${avg !== 'n/a' ? '/10' : ''}
Current streak: ${user.streak_count || 0} days
Status: ${user.status}`;
}
