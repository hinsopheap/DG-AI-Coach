// pages/api/chat/session.js — establishes a web session and (optionally) pairs
// with a Telegram account via a 6-char code from /web in the bot.

import {
  getOrCreateWebUser,
  getUserById,
  consumePairingCode,
  listRecentMessages,
  appendMessage,
  getPath,
  updateUser,
} from '../../../lib/firebase.js';
import { getSessionId, newSessionId, sessionCookie } from '../../../lib/web-session.js';

export default async function handler(req, res) {
  const code = (req.query.code || req.body?.code || '').toString().trim().toUpperCase();
  let sessionId = getSessionId(req);
  let setCookie = false;
  if (!sessionId) {
    sessionId = newSessionId();
    setCookie = true;
  }

  let user = null;

  if (code) {
    const linkedUserId = await consumePairingCode(code, sessionId);
    if (linkedUserId) {
      user = await getUserById(linkedUserId);
    } else {
      if (setCookie) res.setHeader('Set-Cookie', sessionCookie(sessionId));
      return res.status(400).json({ ok: false, error: 'Invalid or expired code.' });
    }
  } else {
    user = await getOrCreateWebUser(sessionId);
    // If session was already linked to a real user that has telegram_id, prefer that
    if (user && user.telegram_id?.startsWith('web_') === false) {
      // Already a paired user — fine
    }
  }

  if (setCookie) res.setHeader('Set-Cookie', sessionCookie(sessionId));

  let messages = await listRecentMessages(user.id, { limit: 30 });

  // Seed a welcome turn for brand-new web users so they see the language picker.
  let initialSuggestions = [];
  if (messages.length === 0 && user.status === 'onboarding' && (user.onboarding_step || 'language') === 'language') {
    const welcome = '👋 Welcome to DG AI Coach — 5 minutes a day to apply AI at work.\n\nFirst, pick your language.';
    await appendMessage(user.id, { role: 'assistant', text: welcome, surface: 'web' });
    messages = await listRecentMessages(user.id, { limit: 30 });
    initialSuggestions = ['English', 'ខ្មែរ'];
  }

  const path = user.learning_path_id ? await getPath(user.learning_path_id) : null;

  return res.status(200).json({
    ok: true,
    user: {
      id:                user.id,
      full_name:         user.full_name || '',
      role:              user.role || '',
      goal:              user.goal || '',
      preferred_language:user.preferred_language || 'en',
      status:            user.status || 'onboarding',
      onboarding_step:   user.onboarding_step || 'language',
      streak_count:      user.streak_count || 0,
      learning_path:     path?.title || null,
      paired_telegram:   user.telegram_id && !user.telegram_id.startsWith('web_'),
      avatar_url:        user.avatar_url || null,
    },
    messages: messages.map(m => ({
      role: m.role,
      text: m.text,
      surface: m.surface,
      created_at: m.created_at?.toDate?.().toISOString() || null,
    })),
    suggestions: initialSuggestions,
  });
}
