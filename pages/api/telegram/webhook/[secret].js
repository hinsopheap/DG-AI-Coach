// pages/api/telegram/webhook/[secret].js
// Telegram bot webhook — onboarding state machine then unified agentic coach.

import {
  getUserByTelegramId,
  logActivity,
  createPairingCode,
  listRecentMessages,
  listSubmissionsForUser,
  listTasksForPath,
  getPath,
} from '../../../../lib/firebase.js';
import { dashboardSnapshot, ACHIEVEMENTS } from '../../../../lib/gamification.js';
import {
  sendMessage,
  sendChatAction,
  editMessageText,
  deleteMessage,
  getFile,
  downloadFileAsBuffer,
  answerCallbackQuery,
  removeKeyboard,
} from '../../../../lib/telegram.js';
import { startOnboarding, handleOnboardingMessage, isOnboarding } from '../../../../lib/onboarding.js';
import { deliverTaskToUser, formatProgress } from '../../../../lib/tasks.js';
import { coachTurn } from '../../../../lib/coach.js';

export const config = { api: { bodyParser: { sizeLimit: '8mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  if (req.query.secret !== process.env.TELEGRAM_WEBHOOK_SECRET) return res.status(403).json({ ok: false });

  res.status(200).json({ ok: true });

  try {
    await routeUpdate(req.body);
  } catch (err) {
    console.error('[webhook] route error:', err);
  }
}

async function routeUpdate(update) {
  // Inline-button taps come as callback_query, not message
  if (update?.callback_query) return handleCallback(update.callback_query);

  const msg = update?.message;
  if (!msg) return;

  const chatId = msg.chat?.id;
  const telegramUser = msg.from;
  const text = (msg.text || '').trim();
  const photo = msg.photo;        // array of PhotoSize, biggest last
  const voice = msg.voice;
  const caption = (msg.caption || '').trim();

  if (!chatId || !telegramUser) return;

  if (text.startsWith('/start')) {
    await startOnboarding(chatId, telegramUser);
    return;
  }

  let user = await getUserByTelegramId(telegramUser.id);
  if (!user) {
    await startOnboarding(chatId, telegramUser);
    return;
  }

  if (isOnboarding(user)) {
    const handled = await handleOnboardingMessage(user, chatId, text);
    if (handled) return;
  }

  // Commands ----------------------------------------------------------------
  if (text === '/help')     return sendMessage(chatId, helpText(user), removeKeyboard()).then(() => {});
  if (text === '/today')    return deliverTaskToUser(user).then(() => {});
  if (text === '/progress') return sendMessage(chatId, await formatProgress(user)).then(() => {});
  if (text === '/practice') return sendPracticeMenu(chatId, user);
  if (text === '/history')  return sendHistory(chatId, user);
  if (text === '/dashboard')return sendDashboard(chatId, user);
  if (text === '/profile')  return sendProfile(chatId, user);
  if (text === '/web' || text === '/link') return sendPairingCode(chatId, user, telegramUser);
  if (text === '/summary') {
    const { buildAndSendSummaryForUser } = await import('../../../../lib/summary.js');
    return buildAndSendSummaryForUser(user).then(() => {});
  }

  // Photo (multimodal) ------------------------------------------------------
  if (photo?.length) {
    return handlePhoto(chatId, user, photo, caption);
  }

  // Voice (placeholder until we wire a Whisper service) ---------------------
  if (voice) {
    await sendMessage(
      chatId,
      '🎙️ I hear you — voice transcription is coming once we wire up the Whisper service. For now, please type your reply or use voice-to-text on your keyboard.',
    );
    await logActivity(user.id, 'voice_note_received', { duration: voice.duration });
    return;
  }

  if (!text) return;

  return runCoachTurn(chatId, user, text);
}

// ── Inline button taps ───────────────────────────────────────────────────────

async function handleCallback(cb) {
  const data = cb.data || '';
  const chatId = cb.message?.chat?.id;
  const telegramUser = cb.from;
  await answerCallbackQuery(cb.id, '').catch(() => {});
  if (!chatId || !telegramUser) return;

  const user = await getUserByTelegramId(telegramUser.id);
  if (!user) return;

  if (data === '/today')    return deliverTaskToUser(user).then(() => {});
  if (data === '/progress') return sendMessage(chatId, await formatProgress(user));
  if (data === '/practice') return sendPracticeMenu(chatId, user);
  if (data === '/history')  return sendHistory(chatId, user);
  if (data === '/dashboard')return sendDashboard(chatId, user);
  if (data === '/profile')  return sendProfile(chatId, user);
  if (data === '/web')      return sendPairingCode(chatId, user, telegramUser);
}

// ── Coach turn with placeholder + edit-in-place for fast perceived latency ───

async function runCoachTurn(chatId, user, text, attachments = []) {
  const [placeholder] = await Promise.all([
    sendMessage(chatId, '_💭 Thinking…_'),
    sendChatAction(chatId, 'typing').catch(() => {}),
  ]);
  const placeholderId = placeholder?.result?.message_id;

  const typingInterval = setInterval(() => {
    sendChatAction(chatId, 'typing').catch(() => {});
  }, 4000);

  let result;
  try {
    result = await coachTurn({ user, surface: 'telegram', text, attachments });
  } finally {
    clearInterval(typingInterval);
  }

  const { reply, deliveries } = result;
  const finalReply = reply || (deliveries.length ? '' : 'I am here. What would you like to work on?');

  if (deliveries.length) {
    if (placeholderId) await deleteMessage(chatId, placeholderId);
    for (const d of deliveries) await sendMessage(chatId, d);
    if (finalReply) await sendMessage(chatId, finalReply, quickActionsKeyboard(user));
  } else if (placeholderId && finalReply) {
    const editRes = await editMessageText(chatId, placeholderId, finalReply, quickActionsKeyboard(user));
    if (!editRes?.ok) {
      await sendMessage(chatId, finalReply, quickActionsKeyboard(user));
      await deleteMessage(chatId, placeholderId);
    }
  } else if (finalReply) {
    await sendMessage(chatId, finalReply, quickActionsKeyboard(user));
  }
}

function quickActionsKeyboard(user) {
  const rows = user?.last_task_id
    ? [[{ text: '📈 Progress', callback_data: '/progress' }, { text: '🎯 Practice', callback_data: '/practice' }]]
    : [[{ text: "📚 Today's task", callback_data: '/today' }, { text: '🎯 Practice', callback_data: '/practice' }]];
  return { reply_markup: { inline_keyboard: rows } };
}

// ── Subroutines ──────────────────────────────────────────────────────────────

async function handlePhoto(chatId, user, photo, caption) {
  // Pick the largest size variant for best detail.
  const biggest = photo[photo.length - 1];
  await sendChatAction(chatId, 'upload_photo').catch(() => {});
  const file = await getFile(biggest.file_id);
  const filePath = file?.result?.file_path;
  if (!filePath) {
    return sendMessage(chatId, 'I could not load that image. Please try again.');
  }
  const buf = await downloadFileAsBuffer(filePath);
  if (!buf) return sendMessage(chatId, 'I could not load that image. Please try again.');

  const ext = filePath.split('.').pop()?.toLowerCase();
  const media_type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const attachments = [{ media_type, data: buf.toString('base64') }];
  await logActivity(user.id, 'photo_received', { caption: caption.slice(0, 200) });

  return runCoachTurn(chatId, user, caption || '', attachments);
}

async function sendPairingCode(chatId, user, telegramUser) {
  const code = await createPairingCode(telegramUser.id);
  const base = process.env.PUBLIC_BASE_URL || '';
  const url = base ? `${base}/chat?code=${code}` : `(open the DG AI Coach web app and enter code ${code})`;
  await sendMessage(
    chatId,
    `🔗 *Open DG AI Coach in your browser*\n\nCode: \`${code}\`\nLink: ${url}\n\nValid for 15 minutes. Once linked, both surfaces share the same conversation.`,
  );
  await logActivity(user.id, 'web_pairing_code_issued');
}

async function sendPracticeMenu(chatId, user) {
  const text = `🎯 *Practice surfaces from DG Academy*

Pick one and I'll suggest a specific prompt to try:

• [DG Chat](https://dgchat.angkorgate.ai) — drop-in AI for daily work
• [AI Eureka](https://aieureka.angkorgate.ai) — guided experiments and templates
• [AI portal](https://ai.angkorgate.ai) — landing hub

Tell me what you're working on and I'll write you a starter prompt to paste into one of these.`;
  await sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🤖 DG Chat', url: 'https://dgchat.angkorgate.ai' }, { text: '💡 AI Eureka', url: 'https://aieureka.angkorgate.ai' }],
        [{ text: '🌐 AI portal', url: 'https://ai.angkorgate.ai' }],
      ],
    },
  });
}

async function sendDashboard(chatId, user) {
  const snap = dashboardSnapshot(user);
  const path = user.learning_path_id ? await getPath(user.learning_path_id) : null;
  const [submissions, tasks] = await Promise.all([
    listSubmissionsForUser(user.id, { limit: 100 }),
    user.learning_path_id ? listTasksForPath(user.learning_path_id) : [],
  ]);
  const scores = submissions.map(s => s.total_score).filter(n => typeof n === 'number');
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10 : null;

  const bar = renderBar(snap.progress, 14);
  const levelEmoji = ['', '🌱', '🌿', '🌳', '⭐', '✨', '🚀', '🏔', '👑'][snap.level] || '👑';

  const achLines = snap.achievements.length
    ? snap.achievements.slice(0, 6).map(a => `${a.icon || '🏅'} ${a.title}`).join('\n')
    : '_none yet — first is unlocked after onboarding_';

  const awardLines = snap.awards.length
    ? snap.awards.slice(0, 3).map(a => `${a.icon || '🎖️'} *${a.title}* — ${a.reason || a.desc || ''}`).join('\n')
    : '';

  const lines = [
    `${levelEmoji} *Level ${snap.level} · ${snap.level_name}*`,
    ``,
    `*XP:* ${snap.xp.toLocaleString()} / ${snap.level_ceil.toLocaleString()}`,
    `${bar} ${Math.round(snap.progress * 100)}%`,
    snap.level_to_next > 0 ? `_${snap.level_to_next} XP to Level ${snap.level + 1}_` : '',
    ``,
    `🔥 *Streak:* ${snap.streak_count} day${snap.streak_count === 1 ? '' : 's'}`,
    `✅ *Tasks:* ${submissions.length}${tasks.length ? ` / ${tasks.length}` : ''}`,
    avg != null ? `📈 *Avg score:* ${avg}/10` : '',
    path ? `📚 *Path:* ${path.title}` : '',
    ``,
    `🏆 *Achievements* (${snap.unlocked_count}/${snap.total_achievements})`,
    achLines,
    awardLines ? `\n🎖️ *Recent awards*\n${awardLines}` : '',
  ].filter(Boolean).join('\n');

  const base = process.env.PUBLIC_BASE_URL || 'https://dg-ai-coach-eta.vercel.app';
  return sendMessage(chatId, lines, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📚 Today's task", callback_data: '/today' }, { text: '🎯 Practice', callback_data: '/practice' }],
        [{ text: '🌐 Open full dashboard', url: `${base}/dashboard` }],
      ],
    },
  });
}

function renderBar(progress, width = 12) {
  const filled = Math.round(progress * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

async function sendProfile(chatId, user) {
  const pairedWeb = !!user.web_session_id;
  const lines = [
    `👤 *Your profile*`,
    ``,
    `*Name:* ${user.full_name || '—'}`,
    `*Role:* ${roleLabel(user.role)}`,
    `*Language:* ${user.preferred_language === 'km' ? '🇰🇭 Khmer' : '🇬🇧 English'}`,
    `*Goal:* ${user.goal || '—'}`,
    ``,
    `*Linked surfaces:*`,
    `${pairedWeb ? '✅' : '⬜'} Web chat`,
    `✅ Telegram (this account)`,
    ``,
    `_Edit in the web profile — tap the button below._`,
  ].join('\n');

  const base = process.env.PUBLIC_BASE_URL || 'https://dg-ai-coach-eta.vercel.app';
  return sendMessage(chatId, lines, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '⚙️ Edit profile on web', url: `${base}/profile` }],
        [{ text: '🔗 Link web chat', callback_data: '/web' }],
      ],
    },
  });
}

function roleLabel(role) {
  return {
    ceo:            'CEO / Founder',
    gm:             'GM / Director',
    senior_manager: 'Senior Manager',
    team_leader:    'Team Leader',
    professional:   'Professional',
  }[role] || '—';
}

async function sendHistory(chatId, user) {
  const messages = await listRecentMessages(user.id, { limit: 10 });
  if (!messages.length) {
    return sendMessage(chatId, 'No coaching history yet. Send a message to get started.');
  }
  const lines = messages.map(m => {
    const who = m.role === 'user' ? '*You:*' : '*Coach:*';
    const text = (m.text || '').slice(0, 200).replace(/\n/g, ' ');
    return `${who} ${text}`;
  });
  const head = `🕐 *Recent coaching messages* (last ${messages.length})\n\n`;
  return sendMessage(chatId, head + lines.join('\n\n'));
}

function helpText(user) {
  const en = `*DG AI Coach — commands*
/today — get today's lesson and task
/dashboard — your level, XP, streak, achievements
/profile — view and edit your profile
/progress — see your streak and scores
/history — show recent coaching messages
/practice — open a DG Academy practice tool
/summary — get your weekly reflection
/web — open the web chat (linked to this account)
/help — show this message

Or just chat freely — ask anything, share an attempt at a task, or send a screenshot of work in progress.`;
  const km = `*DG AI Coach — ពាក្យបញ្ជា*
/today — ទទួលបានកិច្ចការថ្ងៃនេះ
/dashboard — កម្រិត, XP, និងសមិទ្ធផល
/profile — មើល​និង​កែ​ប្រវត្តិរូប
/progress — មើលលទ្ធផលរបស់អ្នក
/history — បង្ហាញសារថ្មីៗ
/practice — បើកឧបករណ៍ហាត់សម
/summary — របាយការណ៍ប្រចាំសប្ដាហ៍
/web — បើកគេហទំព័រ
/help — បង្ហាញសារនេះ`;
  return user.preferred_language === 'km' ? km : en;
}
