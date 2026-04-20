// lib/auth.js — minimal shared-secret cookie auth for the admin dashboard.
// This is deliberately simple for the pilot. Replace with Firebase Auth when
// we have multi-admin requirements.

import crypto from 'crypto';

const COOKIE = 'dgac_admin';
const MAX_AGE = 60 * 60 * 12; // 12h

function secret() {
  return process.env.ADMIN_SESSION_SECRET || 'dev-secret-change-me';
}

function sign(value) {
  const mac = crypto.createHmac('sha256', secret()).update(value).digest('hex').slice(0, 32);
  return `${value}.${mac}`;
}

function verify(signed) {
  if (!signed || !signed.includes('.')) return null;
  const idx = signed.lastIndexOf('.');
  const value = signed.slice(0, idx);
  const mac = signed.slice(idx + 1);
  const expected = crypto.createHmac('sha256', secret()).update(value).digest('hex').slice(0, 32);
  if (mac !== expected) return null;
  return value;
}

export function loginCookie(email) {
  const value = `${email}:${Date.now()}`;
  const signed = sign(value);
  return `${COOKIE}=${encodeURIComponent(signed)}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax`;
}

export function logoutCookie() {
  return `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach(p => {
    const [k, ...rest] = p.trim().split('=');
    if (k) out[k] = decodeURIComponent(rest.join('='));
  });
  return out;
}

export function currentAdmin(req) {
  const cookies = parseCookies(req.headers?.cookie || '');
  const signed = cookies[COOKIE];
  const value = verify(signed);
  if (!value) return null;
  const [email, issuedAt] = value.split(':');
  if (!email || !issuedAt) return null;
  if (Date.now() - Number(issuedAt) > MAX_AGE * 1000) return null;
  return { email };
}

export function requireAdmin(req, res) {
  const admin = currentAdmin(req);
  if (!admin) {
    res.writeHead(302, { Location: '/admin/login' });
    res.end();
    return null;
  }
  return admin;
}

export function requireAdminApi(req, res) {
  const admin = currentAdmin(req);
  if (!admin) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return null;
  }
  return admin;
}

export function validateCredentials(email, password) {
  const expectedEmail = process.env.ADMIN_EMAIL;
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedEmail || !expectedPassword) return false;
  return email === expectedEmail && password === expectedPassword;
}
