// pages/api/telegram/webhook/[secret].js
// Telegram bot webhook — onboarding state machine then unified agentic coach.

import {
  getUserByTelegramId,
  logActivity,
  createPairingCode,
  claimWebPairingCode,
  listRecentMessages,
  listSubmissionsForUser,
  listTasksForPath,
  getPath,
  addReport,
  getLatestAssistantMessage,
  getLatestUserMessage,
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
    const { logError } = await import('../../../../lib/error-log.js');
    await logError('telegram_webhook', err, { update_id: req.body?.update_id });
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
    // Deep-link: /start topic_<id> from a t.me/dgaicoach_bot?start=topic_<id>
    // link. Onboard normally, then queue the topic prompt to fire after the
    // learner reaches active state. We just acknowledge the topic for now
    // and let onboarding complete; the topic will be served by sendTopics
    // once they're past onboarding (or immediately if they already are).
    const startPayload = text.replace(/^\/start\s*/, '').trim();
    await startOnboarding(chatId, telegramUser);

    if (startPayload.startsWith('topic_')) {
      const topicId = startPayload.slice(6);
      const fresh = await getUserByTelegramId(telegramUser.id);
      if (fresh && !isOnboarding(fresh)) {
        // Already onboarded — fire the topic immediately
        const { TOPICS, topicPrompt, noteTopicInterest } = await import('../../../../lib/topics.js');
        const topic = TOPICS.find(x => x.id === topicId);
        if (topic) {
          const lang = fresh.preferred_language === 'km' ? 'km' : 'en';
          noteTopicInterest(fresh.id, topic.id).catch(() => {});
          await runCoachTurn(chatId, fresh, topicPrompt(topic, lang));
        }
      } else if (fresh) {
        await sendMessage(
          chatId,
          'I noted the topic — finish onboarding first and I will pick it up right after.',
        );
        // Stash for post-onboarding pickup
        const { updateUser } = await import('../../../../lib/firebase.js');
        await updateUser(fresh.id, { pending_topic_id: topicId });
      }
    }
    return;
  }

  // /link CODE works at any state — including brand-new Telegram users who
  // signed up on web first. Handle it before onboarding gating.
  if (/^\/link\s+\S+/.test(text)) {
    const code = text.replace(/^\/link\s*/, '').trim().toUpperCase();
    const merged = await claimWebPairingCode(code, telegramUser);
    if (!merged) {
      await sendMessage(chatId, '❌ That code is invalid or expired. Generate a fresh one in the web chat header.');
      return;
    }
    await sendMessage(
      chatId,
      `✅ Linked.\n\nThis Telegram account and the web chat now share one history. Anything you do here shows up on your web dashboard, and vice versa.\n\nName: *${merged.full_name || 'Learner'}*\nXP: *${(merged.xp || 0).toLocaleString()}*\nStreak: *${merged.streak_count || 0}d*\n\nUse /today to get your next task.`,
    );
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
  if (text === '/language' || text === '/lang') return sendLanguagePicker(chatId);
  if (text === '/topics') return sendTopics(chatId, user);
  if (text.startsWith('/report')) {
    const reason = text.replace(/^\/report\s*/, '').trim();
    return reportLatestReply(chatId, user, reason);
  }
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

  // Voice — transcribe via Whisper if configured, else fall back gracefully -
  if (voice) {
    return handleVoice(chatId, user, voice);
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
  if (data.startsWith('topic:')) {
    const { TOPICS, topicPrompt, noteTopicInterest } = await import('../../../../lib/topics.js');
    const topic = TOPICS.find(x => x.id === data.slice(6));
    if (!topic) return;
    const lang = user.preferred_language === 'km' ? 'km' : 'en';
    noteTopicInterest(user.id, topic.id).catch(() => {});
    return runCoachTurn(chatId, user, topicPrompt(topic, lang));
  }
  if (data === 'lang:en' || data === 'lang:km') {
    const { updateUser } = await import('../../../../lib/firebase.js');
    const next = data === 'lang:km' ? 'km' : 'en';
    await updateUser(user.id, { preferred_language: next });
    const msg = next === 'km'
      ? '✅ ភាសាបានកំណត់ជាខ្មែរ។ ខ្ញុំនឹងឆ្លើយជាភាសាខ្មែរពីពេលនេះតទៅ។'
      : "✅ Language set to English. I'll reply in English from now on.";
    return sendMessage(chatId, msg);
  }
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
  } catch (err) {
    clearInterval(typingInterval);
    const { logError } = await import('../../../../lib/error-log.js');
    const { friendlyAIError } = await import('../../../../lib/ai-errors.js');
    await logError('telegram_coach_turn', err, { user_id: user.id });
    const { message } = friendlyAIError(err);
    if (placeholderId) {
      const editRes = await editMessageText(chatId, placeholderId, message, quickActionsKeyboard(user));
      if (!editRes?.ok) {
        await sendMessage(chatId, message, quickActionsKeyboard(user));
        await deleteMessage(chatId, placeholderId).catch(() => {});
      }
    } else {
      await sendMessage(chatId, message, quickActionsKeyboard(user));
    }
    return;
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

async function handleVoice(chatId, user, voice) {
  const { isTranscriptionAvailable, transcribe } = await import('../../../../lib/transcription.js');

  if (!isTranscriptionAvailable()) {
    await sendMessage(
      chatId,
      '🎙️ I hear you — voice transcription is not enabled yet. Please type your reply, or use voice-to-text on your keyboard.',
    );
    await logActivity(user.id, 'voice_note_received', { duration: voice.duration, transcribed: false });
    return;
  }

  await sendChatAction(chatId, 'typing').catch(() => {});
  const file = await getFile(voice.file_id);
  const filePath = file?.result?.file_path;
  if (!filePath) {
    await sendMessage(chatId, "I couldn't fetch that voice note. Please try again.");
    return;
  }

  const buf = await downloadFileAsBuffer(filePath);
  if (!buf) {
    await sendMessage(chatId, "I couldn't download that voice note. Please try again.");
    return;
  }

  const language = user.preferred_language === 'km' ? 'km' : 'en';
  const text = await transcribe(buf, { mimeType: voice.mime_type || 'audio/ogg', language });

  if (!text) {
    await sendMessage(chatId, "I couldn't quite catch that. Try again, or send the message as text.");
    await logActivity(user.id, 'voice_note_received', { duration: voice.duration, transcribed: false });
    return;
  }

  await logActivity(user.id, 'voice_note_received', { duration: voice.duration, transcribed: true, length: text.length });
  return runCoachTurn(chatId, user, text);
}

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

async function reportLatestReply(chatId, user, reason) {
  const last = await getLatestAssistantMessage(user.id);
  if (!last) {
    return sendMessage(chatId, "Nothing to report yet — I haven't sent you any reply this session.");
  }
  const lastUser = await getLatestUserMessage(user.id);
  await addReport({
    user_id:        user.id,
    message_text:   last.text || '',
    last_user_text: lastUser?.text || '',
    reason,
    surface:        'telegram',
  });
  await logActivity(user.id, 'reply_reported', { surface: 'telegram', reason: reason.slice(0, 100) });
  await sendMessage(chatId, '✓ Reported. Thanks — the team will review it.');
}

async function sendTopics(chatId, user) {
  const { topicsForLang } = await import('../../../../lib/topics.js');
  const lang = user?.preferred_language === 'km' ? 'km' : 'en';
  const topics = topicsForLang(lang);

  const intro = lang === 'km'
    ? '✨ ប្រធានបទដែលអ្នកអាចចាប់ផ្ដើមជាមួយខ្ញុំ៖\nចុចមួយ ដើម្បីចាប់ផ្ដើម។'
    : '✨ Pick a topic to start with. Tap one and I will dive in.';

  // Telegram inline_keyboard supports up to 100 buttons; we have 12, comfortable.
  const rows = [];
  for (let i = 0; i < topics.length; i += 2) {
    const row = [topics[i], topics[i + 1]].filter(Boolean).map(t => ({
      text:          `${t.icon} ${t.label.length > 28 ? t.label.slice(0, 26) + '…' : t.label}`,
      callback_data: `topic:${t.id}`,
    }));
    rows.push(row);
  }

  return sendMessage(chatId, intro, { reply_markup: { inline_keyboard: rows } });
}

async function sendLanguagePicker(chatId) {
  return sendMessage(chatId, '🌐 Pick your language.  ·  ជ្រើសរើសភាសារបស់អ្នក។', {
    reply_markup: {
      inline_keyboard: [[
        { text: '🇬🇧 English',  callback_data: 'lang:en' },
        { text: '🇰🇭 ខ្មែរ',     callback_data: 'lang:km' },
      ]],
    },
  });
}

async function sendPracticeMenu(chatId, user) {
  const text = `🎯 *Practice surfaces from DG Academy*

Pick one and I'll suggest a specific prompt to try:

• [DG Academy AI portal](https://ai.thedgacademy.org) — the full program hub
• [DG Chat](https://dgchat.angkorgate.ai) — drop-in AI for daily work
• [AI Eureka](https://aieureka.angkorgate.ai) — guided experiments and prompt patterns

Want to know about the coach? See [Hin Sopheap](https://sopheap.angkorgate.ai).

Tell me what you're working on and I'll write you a starter prompt to paste into one of these.`;
  await sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🌐 AI portal', url: 'https://ai.thedgacademy.org' }],
        [{ text: '🤖 DG Chat', url: 'https://dgchat.angkorgate.ai' }, { text: '💡 AI Eureka', url: 'https://aieureka.angkorgate.ai' }],
        [{ text: '👤 About your coach', url: 'https://sopheap.angkorgate.ai' }],
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

  const base = process.env.PUBLIC_BASE_URL || 'https://dgaicoach.vercel.app';
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

  const base = process.env.PUBLIC_BASE_URL || 'https://dgaicoach.vercel.app';
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
/topics — pick a starter topic to begin with
/dashboard — your level, XP, streak, achievements
/profile — view and edit your profile
/progress — see your streak and scores
/history — show recent coaching messages
/practice — open a DG Academy practice tool
/summary — get your weekly reflection
/web — open the web chat (Telegram → web direction)
/link CODE — claim a code from the web (web → Telegram direction)
/language — switch between English and Khmer
/report — flag the last reply as wrong (optional reason: /report this is incorrect)
/help — show this message

Or just chat freely — ask anything, share an attempt at a task, or send a screenshot of work in progress.`;
  const km = `*DG AI Coach — ពាក្យបញ្ជា*
/today — ទទួលបានកិច្ចការថ្ងៃនេះ
/topics — ជ្រើសប្រធានបទចាប់ផ្ដើម
/dashboard — កម្រិត, XP, និងសមិទ្ធផល
/profile — មើល​និង​កែ​ប្រវត្តិរូប
/progress — មើលលទ្ធផលរបស់អ្នក
/history — បង្ហាញសារថ្មីៗ
/practice — បើកឧបករណ៍ហាត់សម
/summary — របាយការណ៍ប្រចាំសប្ដាហ៍
/web — បើកគេហទំព័រ
/language — ប្ដូរភាសាអង់គ្លេស/ខ្មែរ
/help — បង្ហាញសារនេះ`;
  return user.preferred_language === 'km' ? km : en;
}
