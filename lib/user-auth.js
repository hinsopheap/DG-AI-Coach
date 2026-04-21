// lib/user-auth.js — email + password auth for learners.
//
// Stored on coach_users:
//   email:           string (lowercased)
//   password_hash:   bcrypt hash
//   web_session_id:  rotating value; serves as the active web session token
//
// Sign-in sets web_session_id to a fresh random token and writes it to the
// `dgac_web` cookie. The existing getOrCreateWebUser(sessionId) already
// resolves the logged-in user by this field, so the rest of the app works
// unchanged.

import bcrypt from 'bcryptjs';
import crypto from 'crypto';

import { db, FieldValue, updateUser } from './firebase.js';

const ROUNDS = 10;

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function newAuthToken() {
  return crypto.randomBytes(24).toString('hex');
}

export async function hashPassword(plain) {
  return bcrypt.hash(String(plain), ROUNDS);
}

export async function verifyPassword(plain, hash) {
  if (!plain || !hash) return false;
  try {
    return await bcrypt.compare(String(plain), String(hash));
  } catch {
    return false;
  }
}

export async function findUserByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const snap = await db()
    .collection('coach_users')
    .where('email', '==', normalized)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function createUserWithEmail({ email, password_hash, full_name, web_session_id }) {
  const normalized = normalizeEmail(email);
  const ref = await db().collection('coach_users').add({
    email:              normalized,
    password_hash,
    full_name:          full_name || '',
    web_session_id:     web_session_id || null,
    telegram_id:        `email_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    preferred_language: 'en',
    role:               null,
    goal:               null,
    learning_path_id:   null,
    status:             'onboarding',
    streak_count:       0,
    onboarding_step:    'name',
    surface:            'web',
    xp:                 0,
    level:              1,
    achievements:       [],
    awards:             [],
    created_at:         FieldValue.serverTimestamp(),
    updated_at:         FieldValue.serverTimestamp(),
  });
  const doc = await ref.get();
  return { id: doc.id, ...doc.data() };
}

// Upgrade an existing anonymous web user (created with a `web_<id>` telegram_id
// placeholder) into an account with email + password. Keeps all their messages,
// progress, and XP.
export async function upgradeAnonToAccount(userId, { email, password_hash, full_name }) {
  const patch = {
    email: normalizeEmail(email),
    password_hash,
  };
  if (full_name) patch.full_name = full_name;
  await updateUser(userId, patch);
}

export async function rotateSession(userId) {
  const token = newAuthToken();
  await updateUser(userId, { web_session_id: token });
  return token;
}
