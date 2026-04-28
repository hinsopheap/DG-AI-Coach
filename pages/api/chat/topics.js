// pages/api/chat/topics.js — return localized starter topics for the web UI.

import { getOrCreateWebUser } from '../../../lib/firebase.js';
import { getSessionId } from '../../../lib/web-session.js';
import { topicsForLang } from '../../../lib/topics.js';

export default async function handler(req, res) {
  const sessionId = getSessionId(req);
  let lang = 'en';
  if (sessionId) {
    const user = await getOrCreateWebUser(sessionId);
    lang = user?.preferred_language === 'km' ? 'km' : 'en';
  }
  return res.status(200).json({ ok: true, topics: topicsForLang(lang), lang });
}
