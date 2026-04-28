// lib/reengagement.js — bring dropouts back with a personalized hook.
//
// Runs daily via /api/cron/reengagement. For each active user with a real
// Telegram identity who has been silent for ≥3 days, asks Claude Haiku to
// write a 1-2 sentence re-entry message anchored in their brain memory
// (open threads, last task, named strength). Bot sends it. We mark the
// nudge timestamp so we don't spam the same user.

import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import path from 'node:path';

import { db, getMemory, listRecentMessages, getTask, updateUser, logActivity, FieldValue } from './firebase.js';
import { sendMessage } from './telegram.js';

const MODEL = 'claude-haiku-4-5-20251001';

const INACTIVITY_DAYS = 3;       // start nudging after this many days
const COOLDOWN_DAYS   = 14;      // never re-nudge sooner than this
const MAX_INACTIVITY  = 30;      // skip if they've been gone > this — different problem

function resolveKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  try {
    const file = path.resolve(process.cwd(), '.env.local');
    if (!fs.existsSync(file)) return null;
    const m = fs.readFileSync(file, 'utf8').match(/^ANTHROPIC_API_KEY=(.+)$/m);
    return m ? m[1].trim() : null;
  } catch { return null; }
}

let _client;
function client() {
  if (!_client) _client = new Anthropic({ apiKey: resolveKey() });
  return _client;
}

const SYSTEM = `You write a single re-entry message to a learner who has been silent for a few days.

Goal: get them to come back today by referencing something specific they were working on. Make it feel like a friend texting, not a marketing email.

Hard rules:
- 1-2 sentences. Max 35 words total.
- Reference ONE specific thing from their memory or last task. If memory is thin, name how many days they've been gone and offer the smallest possible re-entry ("five minutes is enough today").
- End with one concrete next move they can do in Telegram: /today, /topics, or a direct question.
- No "we miss you" or "checking in". No emojis except ONE if natural.
- Reply in the learner's preferred language.
- Output ONLY the message, no quotes, no preamble.`;

export async function writeReEntryHook(user, ctx) {
  if (!resolveKey()) return null;

  const lang = user.preferred_language === 'km' ? 'Khmer' : 'English';

  const memoryBrief = ctx.memory ? [
    ctx.memory.open_threads?.length ? `Open threads: ${ctx.memory.open_threads.slice(0, 3).map(t => t.topic).join('; ')}` : '',
    ctx.memory.key_facts?.length ? `Key facts: ${ctx.memory.key_facts.slice(0, 2).join('; ')}` : '',
    ctx.memory.strengths?.length ? `Named strengths: ${ctx.memory.strengths.slice(0, 1).join('; ')}` : '',
  ].filter(Boolean).join('\n') : '';

  const userPrompt = `Learner: ${user.full_name || 'Learner'} (${user.role || 'professional'})
Days inactive: ${ctx.daysInactive}
Streak before silence: ${user.streak_count || 0}
Last task they engaged with: ${ctx.lastTaskTitle || '(none)'}

${memoryBrief ? 'What you know about them:\n' + memoryBrief + '\n\n' : '(No memory yet — keep it simple.)\n\n'}Reply in ${lang}. ONE message. Max 35 words.`;

  try {
    const resp = await client().messages.create({
      model:      MODEL,
      max_tokens: 120,
      system:     SYSTEM,
      messages:   [{ role: 'user', content: userPrompt }],
    });
    const txt = resp.content?.[0]?.text?.trim() || '';
    return txt.replace(/^["'`]|["'`]$/g, '').trim() || null;
  } catch (err) {
    console.error('[reengagement] generation failed:', err.message);
    return null;
  }
}

// Fallback hook used when Anthropic is unavailable. Keeps tone right.
export function fallbackHook(user, daysInactive) {
  const first = (user.full_name || '').split(' ')[0] || 'friend';
  if (user.preferred_language === 'km') {
    return `${first}, ${daysInactive} ថ្ងៃហើយ — ៥ នាទីថ្ងៃនេះគ្រប់គ្រាន់ដើម្បីត្រឡប់មកវិញ។ ផ្ញើ /today ឬ /topics ដើម្បីចាប់ផ្ដើម។`;
  }
  return `Hey ${first} — it's been ${daysInactive} days. Five minutes today is enough to get back in. Send /today, or pick a fresh topic with /topics.`;
}

// ── Eligibility check ────────────────────────────────────────────────────────

export function isEligibleForReengagement(user, lastActivityMs, lastReengagementMs) {
  if (!user || user.status !== 'active') return false;

  const tg = String(user.telegram_id || '');
  // Must have a real Telegram identity (not web_/email_ placeholder)
  if (!tg || /^(web_|email_)/.test(tg)) return false;

  // Need a known last-activity time
  if (!lastActivityMs) return false;

  const now = Date.now();
  const daysInactive = Math.floor((now - lastActivityMs) / 86400000);
  if (daysInactive < INACTIVITY_DAYS) return false;
  if (daysInactive > MAX_INACTIVITY) return false; // different problem; do not auto-nudge

  if (lastReengagementMs) {
    const daysSinceNudge = Math.floor((now - lastReengagementMs) / 86400000);
    if (daysSinceNudge < COOLDOWN_DAYS) return false;
  }

  return true;
}

// ── Per-user pipeline ────────────────────────────────────────────────────────

export async function nudgeUser(user) {
  // Compute last activity from coach_messages (most reliable signal)
  const recent = await listRecentMessages(user.id, { limit: 5 });
  const lastMsg = recent[recent.length - 1];
  const lastActivityMs = lastMsg?.created_at?.toMillis?.() || null;

  const lastReengagementMs = user.last_reengagement_at?.toMillis?.()
    || (user.last_reengagement_at ? new Date(user.last_reengagement_at).getTime() : null);

  if (!isEligibleForReengagement(user, lastActivityMs, lastReengagementMs)) {
    return { ok: false, reason: 'not_eligible' };
  }

  const daysInactive = Math.floor((Date.now() - lastActivityMs) / 86400000);

  const [memory, lastTask] = await Promise.all([
    getMemory(user.id).catch(() => null),
    user.last_task_id ? getTask(user.last_task_id).catch(() => null) : null,
  ]);

  const ctx = {
    daysInactive,
    memory,
    lastTaskTitle: lastTask?.title || null,
  };

  let hook = await writeReEntryHook(user, ctx);
  if (!hook) hook = fallbackHook(user, daysInactive);

  const sent = await sendMessage(user.telegram_id, hook);
  if (!sent?.ok) return { ok: false, reason: 'send_failed' };

  await updateUser(user.id, { last_reengagement_at: FieldValue.serverTimestamp() });
  await logActivity(user.id, 'reengagement_sent', { days_inactive: daysInactive });

  return { ok: true, days_inactive: daysInactive };
}

// ── Cron entry: scan all active users ────────────────────────────────────────

export async function runReengagementSweep() {
  const snap = await db().collection('coach_users').where('status', '==', 'active').get();
  const results = { scanned: 0, sent: 0, skipped: 0, errors: 0 };

  for (const doc of snap.docs) {
    const user = { id: doc.id, ...doc.data() };
    results.scanned += 1;
    try {
      const out = await nudgeUser(user);
      if (out.ok) results.sent += 1;
      else results.skipped += 1;
    } catch (err) {
      console.error('[reengagement] error for', user.id, err.message);
      results.errors += 1;
    }
  }
  return results;
}
