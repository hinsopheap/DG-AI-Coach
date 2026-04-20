import { logoutCookie } from '../../../lib/auth.js';

export default function handler(req, res) {
  res.setHeader('Set-Cookie', logoutCookie());
  res.writeHead(302, { Location: '/admin/login' });
  res.end();
}
