// pages/api/chat/send.js — submit a chat message from the web UI.

import {
  getOrCreateWebUser,
  appendMessage,
} from '../../../lib/firebase.js';
import { getSessionId, newSessionId, sessionCookie } from '../../../lib/web-session.js';
import { handleOnboardingMessage, isOnboarding, startOnboarding } from '../../../lib/onboarding-web.js';
import { coachTurn } from '../../../lib/coach.js';

export const config = { api: { bodyParser: { sizeLimit: '8mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const text = (req.body?.text || '').toString().trim();
  const attachments = Array.isArray(req.body?.attachments) ? req.body.attachments.slice(0, 4) : [];

  if (!text && !attachments.length) {
    return res.status(400).json({ ok: false, error: 'Empty message' });
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

  const result = await coachTurn({ user, surface: 'web', text, attachments });

  return res.status(200).json({
    ok:          true,
    replies:     [...(result.deliveries || []), result.reply].filter(Boolean),
    suggestions: result.suggestions || [],
  });
}
