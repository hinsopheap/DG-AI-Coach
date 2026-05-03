// lib/brain.js — the coach's memory + consolidation layer.
//
// The brain has two halves working together:
//   - Cache (short-term):  last ~20 messages, loaded into every turn
//   - Memory (long-term):  coach_memory/{userId} — a distilled JSON document
//                          of who the learner is and what they're working on.
//
// The memory is updated asynchronously by a cheap Haiku call every ~6 user
// turns. It's loaded on every coach turn and injected into the system prompt,
// so the coach reasons with personality + open threads + observed style, not
// just the last few messages.

import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import path from 'node:path';

import {
  getMemory,
  setMemory,
  listRecentMessages,
  logActivity,
} from './firebase.js';

const MODEL = 'claude-haiku-4-5-20251001';
const TURNS_BETWEEN_CONSOLIDATION = 6;

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

// ── Rendering memory into a system-prompt block ──────────────────────────────

export function renderMemoryForPrompt(memory) {
  if (!memory) return '';
  const lines = ['## What you\'ve learned about this learner'];

  const p = memory.personality || {};
  const personalityBits = [];
  if (p.prompt_style) personalityBits.push(`how they prompt: ${p.prompt_style}`);
  if (p.communication_style) personalityBits.push(`communication: ${p.communication_style}`);
  if (p.engagement_level) personalityBits.push(`engagement: ${p.engagement_level}`);
  if (p.energy_state) personalityBits.push(`energy state right now: ${p.energy_state}`);
  if (p.openness_to_challenge) personalityBits.push(`openness to challenge: ${p.openness_to_challenge}`);
  if (personalityBits.length) lines.push('- Personality — ' + personalityBits.join('; '));

  if (memory.interests?.length) lines.push('- Interests: ' + memory.interests.join(', '));
  if (memory.strengths?.length) lines.push('- Strengths you\'ve named: ' + memory.strengths.join('; '));
  if (memory.growth_areas?.length) lines.push('- Growth edges: ' + memory.growth_areas.join('; '));

  const prefs = memory.preferences || {};
  const prefBits = [];
  if (prefs.response_length) prefBits.push(`prefers ${prefs.response_length} replies`);
  if (prefs.prefers_examples) prefBits.push('learns better with concrete examples');
  if (prefs.uses_emojis === true) prefBits.push('responds well to light emoji use');
  if (prefs.uses_emojis === false) prefBits.push('keep emojis minimal');
  if (prefBits.length) lines.push('- Style preferences: ' + prefBits.join('; '));

  if (memory.open_threads?.length) {
    lines.push('- Open threads (follow up when natural):');
    for (const t of memory.open_threads.slice(0, 6)) {
      lines.push(`    • ${t.topic}${t.status && t.status !== 'open' ? ` [${t.status}]` : ''}`);
    }
  }

  if (memory.key_facts?.length) {
    lines.push('- Key facts about them and their work:');
    for (const f of memory.key_facts.slice(0, 10)) {
      lines.push(`    • ${f}`);
    }
  }

  lines.push('');
  lines.push('Use this actively. Reference specific things you remember. Adapt your style to theirs. Follow up on open threads when the moment is right — a good coach remembers.');

  return lines.length > 2 ? lines.join('\n') : '';
}

// ── Consolidation: turn raw messages into distilled memory ───────────────────

const SCHEMA = {
  personality: {
    prompt_style: 'string — how they phrase questions (e.g. "terse, stacks multiple asks per message", "verbose, narrative")',
    communication_style: 'string — overall communication (e.g. "direct, action-oriented", "analytical, asks for rationale")',
    engagement_level: 'high | medium | low',
    openness_to_challenge: 'high | medium | low',
    energy_state: 'flat | steady | confident | overwhelmed | avoidant — what their recent messages signal about how they are showing up. Coach uses this to set tone (lift when flat, slow when overwhelmed, stretch when confident, name avoidance gently).',
  },
  interests: ['up to 8 short phrases, e.g. "AI for SME operations"'],
  strengths: ['up to 6 specific strengths, e.g. "frames problems concretely with hours and owner"'],
  growth_areas: ['up to 4 specific edges, e.g. "tends to jump to solutions before examining assumptions"'],
  preferences: {
    response_length: 'short | medium | long',
    prefers_examples: 'boolean',
    uses_emojis: 'boolean',
  },
  open_threads: [
    { topic: 'short phrase', stated_at: 'YYYY-MM-DD', status: 'open | done | stalled' },
  ],
  key_facts: ['up to 10 concrete facts about their role, team, industry, projects'],
};

const CONSOLIDATION_SYSTEM = `You are the memory consolidation module for DG AI Coach.

Your job: update a structured memory about a coaching learner based on recent conversation. You care about who the learner is as a person and a professional — not just what they said most recently.

You pay special attention to HOW they prompt the coach: their word choice, sentence length, tone, what they leave unsaid, whether they stack multiple asks or take one at a time, how formal they are, how they respond to challenge. Their prompting style IS their personality at work — capture it.

You return ONLY a JSON object matching this schema:
${JSON.stringify(SCHEMA, null, 2)}

Rules:
- Preserve existing correct information. Merge new observations into it, don't wipe the slate each turn.
- Be specific. "Direct communicator" < "writes 1-sentence prompts, asks for the answer not the thinking".
- Be evidence-based. Do not invent facts not supported by the conversation.
- Keep total output under ~1500 characters.
- When a commitment is completed, mark its open_thread status as "done". When a topic goes cold for 2+ turns, mark "stalled".
- Output ONLY the JSON. No markdown code fences. No explanation.`;

export async function consolidateMemory(userId, userMeta = {}) {
  if (!resolveKey()) return { ok: false, reason: 'no_api_key' };

  const [current, messages] = await Promise.all([
    getMemory(userId),
    listRecentMessages(userId, { limit: 30 }),
  ]);
  if (messages.length < 3) return { ok: false, reason: 'too_few_messages' };

  const transcript = messages
    .map(m => `[${m.role}] ${(m.text || '').replace(/\s+/g, ' ').slice(0, 300)}`)
    .join('\n');

  const userPrompt = `Learner profile:
- Name: ${userMeta.full_name || 'unknown'}
- Role: ${userMeta.role || 'unknown'}
- Goal: ${userMeta.goal || 'unknown'}

Current memory:
${current ? JSON.stringify(stripMeta(current), null, 2) : '(none yet — this is the first consolidation)'}

Recent conversation (oldest first):
${transcript}

Return the updated memory JSON.`;

  let resp;
  try {
    resp = await client().messages.create({
      model:      MODEL,
      max_tokens: 1200,
      system:     CONSOLIDATION_SYSTEM,
      messages:   [{ role: 'user', content: userPrompt }],
    });
  } catch (err) {
    console.error('[brain] consolidation API error:', err.message);
    return { ok: false, reason: err.message };
  }

  const raw = resp.content?.[0]?.text || '';
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    console.error('[brain] consolidation returned no JSON');
    return { ok: false, reason: 'no_json' };
  }

  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch (err) {
    console.error('[brain] consolidation parse failed:', err.message);
    return { ok: false, reason: 'parse_error' };
  }

  await setMemory(userId, {
    ...parsed,
    last_consolidated_at: new Date().toISOString(),
    consolidated_message_count: messages.length,
  });
  await logActivity(userId, 'memory_consolidated', {
    messages_seen: messages.length,
  });

  return { ok: true, memory: parsed };
}

function stripMeta(memory) {
  const { id, updated_at, last_consolidated_at, consolidated_message_count, ...rest } = memory || {};
  return rest;
}

// ── When to consolidate ──────────────────────────────────────────────────────
//
// Fire-and-forget after every N user turns. Called from coachTurn after it has
// already replied, so this never blocks the user.

// Cheap pure check — safe to call every turn. Decides whether the brain
// needs to consolidate right now based on already-loaded state.
export function shouldConsolidate({ memory, messageCount }) {
  const lastAt = memory?.consolidated_message_count || 0;
  return messageCount - lastAt >= TURNS_BETWEEN_CONSOLIDATION * 2; // 2 msgs per turn (user+assistant)
}

export async function maybeConsolidate(user, { memory, messageCount } = {}) {
  try {
    if (memory !== undefined && messageCount !== undefined) {
      if (!shouldConsolidate({ memory, messageCount })) return;
    }
    await consolidateMemory(user.id, user);
  } catch (err) {
    console.error('[brain] maybeConsolidate failed:', err);
  }
}

// ── Explicit write from a coach tool ─────────────────────────────────────────

export async function rememberFact(userId, category, value) {
  const memory = (await getMemory(userId)) || {};
  const allowed = ['key_facts', 'strengths', 'growth_areas', 'interests'];
  const cat = allowed.includes(category) ? category : 'key_facts';
  const current = Array.isArray(memory[cat]) ? memory[cat] : [];
  const trimmed = String(value || '').trim().slice(0, 180);
  if (!trimmed) return;
  if (current.includes(trimmed)) return;
  const next = [...current, trimmed].slice(-12);
  await setMemory(userId, { [cat]: next });
}
