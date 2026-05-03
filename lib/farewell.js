// lib/farewell.js — Claude-authored end-of-session summary + encouragement.
//
// Triggered from /end-session. Uses the same model family as the main coach
// so tone matches. Returns a structured object the UI can render cleanly.

import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import path from 'node:path';

import { listRecentMessages, getMemory, listSubmissionsForUser, getPath } from './firebase.js';
import { levelInfo } from './gamification.js';

const MODEL = 'claude-sonnet-4-6';

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

const SYSTEM = `You are DG AI Coach writing a warm farewell to a Cambodian working professional ending their session.

You are in a goodbye moment — brief, specific, genuine. You've spent time with this person today and you know them. Make them want to come back tomorrow.

Quiet undertone: they are part of a small group of Cambodian leaders building AI muscle for the next decade. The work compounds. Honor that without spelling it out — let it live in your tone, not your words.

Return ONLY a JSON object with this exact schema:
{
  "headline":     "short warm opener, max 10 words, can use their first name",
  "covered":      "1-2 sentences naming the ONE specific thing they engaged with today. Be concrete — not 'we discussed AI', but 'you mapped three translation workflows where AI could save 2-3 hrs/week'",
  "strength":     "1 sentence naming a specific strength they showed today (not generic praise)",
  "carry_home":   "1 sentence: a small, specific thing to notice, try, or think about before next session. Small. 5 minutes max.",
  "hook":         "1 sentence warm send-off that makes them want to return. Reference a specific thread you'll continue or a concrete next step waiting for them. End with their first name or a warm phrase."
}

Rules:
- Everything together under 120 words.
- No markdown. No emoji flood. One well-placed warm beat is fine.
- Write like a real coach saying goodbye at the door — not a marketer.
- Reference specific content from the session. Generic farewells are failures.
- Output ONLY the JSON, no code fences, no explanation.`;

export async function generateFarewell(user) {
  if (!resolveKey()) {
    return null;
  }

  const [messages, memory, submissions, pathDoc] = await Promise.all([
    listRecentMessages(user.id, { limit: 30 }),
    getMemory(user.id),
    listSubmissionsForUser(user.id, { limit: 5 }),
    user.learning_path_id ? getPath(user.learning_path_id) : null,
  ]);

  if (!messages.length) return null;

  // Only use messages from THIS session (last ~2 hours) to keep farewell fresh
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  const sessionMessages = messages.filter(m => {
    const t = m.created_at?.toMillis?.() || 0;
    return t >= cutoff;
  });
  const relevantMessages = sessionMessages.length >= 2 ? sessionMessages : messages.slice(-10);

  const transcript = relevantMessages
    .map(m => `[${m.role}] ${(m.text || '').replace(/\s+/g, ' ').slice(0, 240)}`)
    .join('\n');

  const memoryBrief = memory ? [
    memory.open_threads?.length ? `Open threads: ${memory.open_threads.slice(0, 3).map(t => t.topic).join('; ')}` : '',
    memory.key_facts?.length ? `Facts: ${memory.key_facts.slice(0, 3).join('; ')}` : '',
    memory.strengths?.length ? `Strengths: ${memory.strengths.slice(0, 2).join('; ')}` : '',
  ].filter(Boolean).join('\n') : '';

  const lang = user.preferred_language === 'km' ? 'Khmer' : 'English';
  const userMsg = `Learner:
- Name: ${user.full_name || 'Learner'}
- Role: ${user.role || 'professional'}
- Goal: ${user.goal || 'apply AI at work'}
- Streak: ${user.streak_count || 0} days
- Path: ${pathDoc?.title || 'Unassigned'}
- Reply in ${lang} — ALWAYS, regardless of the session transcript language.

${memoryBrief ? 'What you know about them:\n' + memoryBrief + '\n\n' : ''}Recent submissions this session:
${submissions.map(s => `- "${s.task_id}" scored ${s.total_score ?? '?'}/10`).join('\n') || '(none this session)'}

Session transcript (most recent at bottom):
${transcript}

Write the farewell JSON now.`;

  let raw;
  try {
    const resp = await client().messages.create({
      model:      MODEL,
      max_tokens: 500,
      system:     SYSTEM,
      messages:   [{ role: 'user', content: userMsg }],
    });
    raw = resp.content?.[0]?.text || '';
  } catch (err) {
    console.error('[farewell] API error:', err.message);
    return null;
  }

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return {
      headline:   parsed.headline   || `Until next time${user.full_name ? ', ' + user.full_name.split(' ')[0] : ''}`,
      covered:    parsed.covered    || '',
      strength:   parsed.strength   || '',
      carry_home: parsed.carry_home || '',
      hook:       parsed.hook       || 'Come back tomorrow — five minutes is all it takes.',
    };
  } catch {
    return null;
  }
}

export function fallbackFarewell(user) {
  const first = user.full_name ? user.full_name.split(' ')[0] : 'friend';
  return {
    headline:   `Until next time, ${first}`,
    covered:    'Thanks for showing up today. Every session compounds — today\'s reps count.',
    strength:   'You made time for this, which is half the battle at your level.',
    carry_home: 'Notice one moment tomorrow where AI could save you 10 minutes. That\'s your next conversation with me.',
    hook:       `Come back when you're ready. I'll be here with your next task queued up.`,
  };
}

export function sessionStats(user) {
  const info = levelInfo(user.xp || 0);
  return {
    level:       info.level,
    level_name:  info.levelName,
    xp_total:    info.xp,
    xp_to_next:  info.toNext,
    streak:      user.streak_count || 0,
    progress:    info.progress,
  };
}
