// pages/api/auth/signout.js — clear the web session cookie. The user
// document keeps web_session_id so signing in on another device still works.

export default function handler(req, res) {
  res.setHeader('Set-Cookie', 'dgac_web=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
  res.writeHead(302, { Location: '/' });
  res.end();
}
