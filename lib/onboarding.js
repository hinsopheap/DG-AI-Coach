// lib/onboarding.js — conversation state machine for the Telegram bot.
// Stores state on the user document (onboarding_step) so any node can resume it.

import {
  getUserByTelegramId,
  createUser,
  updateUser,
  setUserAvatar,
  getDefaultPathForRole,
  logActivity,
} from './firebase.js';
import { sendMessage, keyboard, removeKeyboard, getUserProfilePhotos, getFile, fileDownloadUrl } from './telegram.js';

const ROLES = [
  ['CEO / Founder', 'GM / Director'],
  ['Senior Manager', 'Team Leader'],
  ['Professional', 'Other'],
];

const GOALS = [
  ['Use AI daily at work'],
  ['Draft faster with AI'],
  ['Coach my team with AI'],
  ['Explore AI fundamentals'],
];

const LANGUAGES = [['English', 'ខ្មែរ']];

function mapRole(label) {
  const s = (label || '').toLowerCase();
  if (s.includes('ceo') || s.includes('founder')) return 'ceo';
  if (s.includes('gm') || s.includes('director')) return 'gm';
  if (s.includes('senior')) return 'senior_manager';
  if (s.includes('leader')) return 'team_leader';
  if (s.includes('professional')) return 'professional';
  return 'professional';
}

function mapLanguage(label) {
  if (!label) return 'en';
  return label.includes('ខ្មែរ') || /khmer/i.test(label) ? 'km' : 'en';
}

export async function startOnboarding(chatId, telegramUser) {
  const existing = await getUserByTelegramId(telegramUser.id);
  if (existing) {
    await sendMessage(
      chatId,
      `Welcome back, ${existing.full_name || 'friend'}. Send /today to get your task, /coach to ask a question, or /progress to see your stats.`,
      removeKeyboard(),
    );
    await logActivity(existing.id, 'session_restart');
    return existing;
  }

  const { id } = await createUser({
    telegram_id: telegramUser.id,
    full_name:   [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' '),
  });
  await updateUser(id, { onboarding_step: 'language' });
  await logActivity(id, 'onboarding_started');

  // Best-effort: fetch the user's Telegram profile photo so they have an
  // avatar from the first turn on web.
  fetchTelegramAvatar(id, telegramUser.id).catch(() => {});

  await sendMessage(
    chatId,
    `👋 Welcome to *DG AI Coach* — 5 minutes a day to apply AI at work.\n\nFirst, pick your language.`,
    keyboard(LANGUAGES),
  );
  return { id, telegram_id: String(telegramUser.id), onboarding_step: 'language' };
}

// Routes a message during onboarding. Returns true if it was handled.
export async function handleOnboardingMessage(user, chatId, text) {
  const step = user.onboarding_step || 'start';

  switch (step) {
    case 'language': {
      const lang = mapLanguage(text);
      await updateUser(user.id, { preferred_language: lang, onboarding_step: 'name' });
      await sendMessage(
        chatId,
        lang === 'km'
          ? 'ល្អហើយ។ តើអ្នកមានឈ្មោះពេញជាអ្វី?'
          : 'Great. What is your full name?',
        removeKeyboard(),
      );
      return true;
    }
    case 'name': {
      const raw = (text || '').trim();
      if (!raw || raw.startsWith('/')) {
        await sendMessage(chatId, 'Please send your name as a text message (no slash commands during onboarding).');
        return true;
      }
      const name = raw.slice(0, 80);
      await updateUser(user.id, { full_name: name, onboarding_step: 'role' });
      await sendMessage(
        chatId,
        `Nice to meet you, ${name}. Which best describes your role?`,
        keyboard(ROLES),
      );
      return true;
    }
    case 'role': {
      const role = mapRole(text);
      await updateUser(user.id, { role, onboarding_step: 'goal' });
      await sendMessage(
        chatId,
        `Got it. What is your main learning goal right now?`,
        keyboard(GOALS),
      );
      return true;
    }
    case 'goal': {
      const goal = (text || '').trim().slice(0, 200);
      await updateUser(user.id, { goal });

      try {
        const fresh = await getUserByTelegramId(user.telegram_id);
        const path = await getDefaultPathForRole(fresh.role);
        if (path) {
          await updateUser(fresh.id, {
            learning_path_id: path.id,
            status:           'active',
            onboarding_step:  'done',
          });
          await logActivity(fresh.id, 'onboarding_complete', { path_id: path.id });
          await sendMessage(
            chatId,
            `✅ You are enrolled in *${path.title}*.\n\nUse /today for today's task, /web to open the web chat, or just chat with me freely.`,
            removeKeyboard(),
          );
        } else {
          await updateUser(fresh.id, { status: 'waitlist', onboarding_step: 'done' });
          await sendMessage(chatId, `Thanks — no learning path is live yet for your role. I'll notify you when one opens.`, removeKeyboard());
        }
      } catch (err) {
        // Never strand the learner mid-onboarding. Mark them active with no path
        // and let admin assign one later.
        console.error('[onboarding] path assignment failed:', err);
        await updateUser(user.id, { status: 'active', onboarding_step: 'done' });
        await sendMessage(chatId, `Thanks. I had a hiccup assigning your path — an admin will sort it out shortly. In the meantime, just chat freely.`, removeKeyboard());
      }
      return true;
    }
    default:
      return false;
  }
}

export function isOnboarding(user) {
  if (!user) return true;
  return user.status !== 'active' && user.status !== 'waitlist';
}

async function fetchTelegramAvatar(userId, telegramUserId) {
  const photos = await getUserProfilePhotos(telegramUserId);
  const photo = photos?.result?.photos?.[0];
  if (!photo?.length) return;
  // Pick the smallest size (avatars don't need to be huge).
  const small = photo.reduce((best, cur) => (cur.file_size < best.file_size ? cur : best), photo[0]);
  const file = await getFile(small.file_id);
  const url = file?.result?.file_path ? fileDownloadUrl(file.result.file_path) : null;
  if (url) await setUserAvatar(userId, url);
}
