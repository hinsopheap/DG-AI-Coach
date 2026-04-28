// lib/daily-intro.js — generate a one-line personalized intro for today's
// task, anchored in what the coach knows about the learner.
//
// We deliberately keep the SEQUENCED task content untouched (paths are
// designed in order). Only the framing line changes — that's where
// personalization lives at lowest risk and highest engagement.

import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import path from 'node:path';

import { getMemory } from './firebase.js';

const MODEL = 'claude-haiku-4-5-20251001';

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

const SYSTEM = `You write the ONE-LINE personal hook that opens a daily coaching task.

Given the learner's profile + memory + the task they're about to receive, write a single sentence that:
- references something specific you know about them (their work, an open thread, a strength they showed)
- connects it to today's task in a natural way
- makes them want to open the task

Hard rules:
- ONE sentence. Max 22 words.
- Reply in the learner's preferred language.
- No greetings ("Good morning…"), no preamble. Start with the hook itself.
- If memory is empty, return a simple universal hook tied to the task title.
- Output ONLY the sentence — no quotes, no explanation, no markdown.`;

export async function generateDailyIntro(user, task) {
  if (!resolveKey() || !task) return null;

  const memory = await getMemory(user.id).catch(() => null);
  const lang = user.preferred_language === 'km' ? 'Khmer' : 'English';

  const memoryBrief = memory ? [
    memory.open_threads?.length ? `Open threads: ${memory.open_threads.slice(0, 3).map(t => t.topic).join('; ')}` : '',
    memory.key_facts?.length ? `Key facts: ${memory.key_facts.slice(0, 3).join('; ')}` : '',
    memory.interests?.length ? `Interests: ${memory.interests.slice(0, 3).join('; ')}` : '',
  ].filter(Boolean).join('\n') : '';

  const userPrompt = `Learner:
- Name: ${user.full_name || 'Learner'}
- Role: ${user.role || 'professional'}
- Goal: ${user.goal || 'apply AI at work'}
- Streak: ${user.streak_count || 0} days

${memoryBrief ? 'What you know about them:\n' + memoryBrief + '\n\n' : '(No memory yet — keep the hook universal.)\n\n'}Today's task title: ${task.title}
Task prompt: ${task.prompt_text}

Reply in ${lang}. ONE sentence, max 22 words. No quotes. No greetings.`;

  try {
    const resp = await client().messages.create({
      model:      MODEL,
      max_tokens: 80,
      system:     SYSTEM,
      messages:   [{ role: 'user', content: userPrompt }],
    });
    const txt = resp.content?.[0]?.text?.trim() || '';
    // Strip surrounding quotes if Claude added them
    return txt.replace(/^["'`]|["'`]$/g, '').trim() || null;
  } catch (err) {
    console.error('[daily-intro] generation failed:', err.message);
    return null;
  }
}
