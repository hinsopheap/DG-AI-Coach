import { validateCredentials, loginCookie } from '../../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const { email, password } = req.body || {};
  if (!validateCredentials(email, password)) {
    return res.status(401).json({ ok: false, error: 'Invalid credentials' });
  }
  res.setHeader('Set-Cookie', loginCookie(email));
  return res.status(200).json({ ok: true });
}
