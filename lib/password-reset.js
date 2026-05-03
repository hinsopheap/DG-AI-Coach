// lib/password-reset.js — password reset that uses Telegram as the trust
// channel. The user's linked Telegram account receives a one-time link.
// This sidesteps an email service dependency and is more secure (the bot is
// already authenticated to the user's identity).

import crypto from 'crypto';

import { db, FieldValue, Timestamp, updateUser } from './firebase.js';
import { findUserByEmail, hashPassword, normalizeEmail, rotateSession } from './user-auth.js';
import { sendMessage } from './telegram.js';

const TOKEN_TTL_MS = 30 * 60 * 1000;

function genToken() {
  return crypto.randomBytes(24).toString('hex');
}

// Returns one of: { ok: true, channel: 'telegram' | 'email' }
//               | { ok: false, reason: 'no_account' | 'no_channel' | 'send_failed' }
//
// Channel preference: Telegram first (more secure — already auth'd to user),
// fall back to email if Telegram isn't linked AND email service is enabled.
export async function requestReset(email, baseUrl) {
  const normalized = normalizeEmail(email);
  const user = await findUserByEmail(normalized);
  if (!user) return { ok: false, reason: 'no_account' };

  // Issue a token regardless of channel — same shape, same TTL
  const token = genToken();
  await db().collection('coach_password_resets').doc(token).set({
    token,
    user_id:    user.id,
    used:       false,
    created_at: FieldValue.serverTimestamp(),
    expires_at: Timestamp.fromMillis(Date.now() + TOKEN_TTL_MS),
  });

  const link = `${baseUrl.replace(/\/$/, '')}/reset?token=${token}`;
  const tg = String(user.telegram_id || '');
  const hasTelegram = tg && !/^(web_|email_)/.test(tg);

  // Prefer Telegram (auth'd channel)
  if (hasTelegram) {
    const text = [
      '🔐 *Password reset requested*',
      '',
      'Someone (probably you) asked to reset the password on your DG AI Coach account.',
      '',
      `Open this link within 30 minutes to set a new password:`,
      link,
      '',
      `If this wasn't you, ignore this message — the link expires automatically.`,
    ].join('\n');
    const result = await sendMessage(tg, text);
    if (result?.ok) return { ok: true, channel: 'telegram' };
    // Fall through to email if Telegram send failed
  }

  // Email fallback
  try {
    const { sendEmail, isEmailEnabled, passwordResetEmail } = await import('./email.js');
    if (isEmailEnabled()) {
      const tpl = passwordResetEmail({ name: user.full_name, link });
      const r = await sendEmail({ to: normalized, ...tpl });
      if (r?.ok) return { ok: true, channel: 'email' };
    }
  } catch (err) {
    console.error('[password-reset] email fallback failed:', err.message);
  }

  return { ok: false, reason: 'no_channel' };
}

export async function consumeResetToken(token, newPassword) {
  if (!token || !newPassword || newPassword.length < 8) {
    return { ok: false, error: 'Invalid input.' };
  }
  const ref = db().collection('coach_password_resets').doc(token);
  const doc = await ref.get();
  if (!doc.exists) return { ok: false, error: 'Invalid or expired link.' };
  const data = doc.data();
  if (data.used) return { ok: false, error: 'This link has already been used.' };
  if (data.expires_at?.toMillis?.() < Date.now()) {
    return { ok: false, error: 'This link has expired. Request a new reset.' };
  }

  const password_hash = await hashPassword(newPassword);
  await updateUser(data.user_id, { password_hash });
  await ref.update({ used: true, used_at: FieldValue.serverTimestamp() });

  // Rotate the active web session so old cookies are invalidated.
  const newToken = await rotateSession(data.user_id);
  return { ok: true, session_token: newToken };
}
