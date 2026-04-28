// pages/api/chat/send.js — submit a chat message from the web UI.

import {
  getOrCreateWebUser,
  appendMessage,
} from '../../../lib/firebase.js';
import { getSessionId, newSessionId, sessionCookie } from '../../../lib/web-session.js';
import { handleOnboardingMessage, isOnboarding, startOnboarding } from '../../../lib/onboarding-web.js';
import { coachTurn } from '../../../lib/coach.js';
import { rateLimit } from '../../../lib/rate-limit.js';
import { logError } from '../../../lib/error-log.js';
import { friendlyAIError } from '../../../lib/ai-errors.js';

export const config = { api: { bodyParser: { sizeLimit: '8mb' } } };

const MAX_MESSAGE_CHARS = 4000;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  // 30 messages/min per IP. Burst-tolerant for normal chat, hostile to flooders.
  if (rateLimit(req, res, { scope: 'chat', limit: 30, windowMs: 60_000 })) return;

  const text = (req.body?.text || '').toString().trim();
  const attachments = Array.isArray(req.body?.attachments) ? req.body.attachments.slice(0, 4) : [];

  if (!text && !attachments.length) {
    return res.status(400).json({ ok: false, error: 'Empty message' });
  }
  if (text.length > MAX_MESSAGE_CHARS) {
    return res.status(413).json({ ok: false, error: `Message too long. Keep it under ${MAX_MESSAGE_CHARS} characters.` });
  }

  let sessionId = getSessionId(req);
  if (!sessionId) {
    sessionId = newSessionId();
    res.setHeader('Set-Cookie', sessionCookie(sessionId));
  }

  let user = await getOrCreateWebUser(sessionId);

  if (isOnboarding(user)) {
    // Onboarding does not yet support attachments — fall through to text-only.
    const out = await handleOnboardingMessage(user, text || '');
    return res.status(200).json({
      ok:          true,
      replies:     out.replies,
      suggestions: out.suggestions || [],
      user:        out.user,
    });
  }

  // Topic-aware brain: when this message came from a topic chip tap, tag
  // the topic as an interest so future sessions reference it.
  const topicId = String(req.body?.topic_id || '').trim();
  if (topicId) {
    try {
      const { noteTopicInterest } = await import('../../../lib/topics.js');
      await noteTopicInterest(user.id, topicId);
    } catch {}
  }

  let result;
  try {
    result = await coachTurn({ user, surface: 'web', text, attachments });
  } catch (err) {
    await logError('chat_send', err, { user_id: user.id });
    const { message, retriable } = friendlyAIError(err);
    return res.status(retriable ? 503 : 200).json({
      ok:          true,
      replies:     [message],
      suggestions: ['Try again', 'My progress'],
    });
  }

  return res.status(200).json({
    ok:          true,
    replies:     [...(result.deliveries || []), result.reply].filter(Boolean),
    suggestions: result.suggestions || [],
  });
}
