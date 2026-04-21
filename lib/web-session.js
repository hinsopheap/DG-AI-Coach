// lib/web-session.js — anonymous cookie-based session for the web chat.

import crypto from 'crypto';

const COOKIE = 'dgac_web';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach(p => {
    const [k, ...rest] = p.trim().split('=');
    if (k) out[k] = decodeURIComponent(rest.join('='));
  });
  return out;
}

export function getSessionId(req) {
  const cookies = parseCookies(req.headers?.cookie || '');
  return cookies[COOKIE] || null;
}

export function newSessionId() {
  return crypto.randomBytes(18).toString('hex');
}

export function sessionCookie(sessionId) {
  return `${COOKIE}=${encodeURIComponent(sessionId)}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax; HttpOnly`;
}
