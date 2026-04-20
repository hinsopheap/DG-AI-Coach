// pages/api/chat/avatar.js — accept a base64 avatar from the web chat and
// store it on the user document. Client is responsible for resizing the image
// to ~80x80 before sending so the data URL stays under ~50KB.

import { getOrCreateWebUser, setUserAvatar } from '../../../lib/firebase.js';
import { getSessionId, newSessionId, sessionCookie } from '../../../lib/web-session.js';

export const config = { api: { bodyParser: { sizeLimit: '512kb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const dataUrl = (req.body?.dataUrl || '').toString();
  if (!dataUrl.startsWith('data:image/')) {
    return res.status(400).json({ ok: false, error: 'Expected an image data URL' });
  }
  if (dataUrl.length > 200_000) {
    return res.status(413).json({ ok: false, error: 'Image too large — keep it under ~150KB' });
  }

  let sessionId = getSessionId(req);
  if (!sessionId) {
    sessionId = newSessionId();
    res.setHeader('Set-Cookie', sessionCookie(sessionId));
  }

  const user = await getOrCreateWebUser(sessionId);
  await setUserAvatar(user.id, dataUrl);

  return res.status(200).json({ ok: true, avatar_url: dataUrl });
}
