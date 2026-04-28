// lib/task-picker.js — coach picks the best NEXT task for a learner.
//
// Default behaviour stays sequential (paths are designed in order). When the
// brain has substance — interests, open threads, growth_areas — we ask
// Haiku to pick the most useful task from the next candidates instead of
// strictly following sequence. Falls back to sequential silently.
//
// Why not always personalize: paths have pedagogical order. Skipping ahead
// can break scaffolding. The smart picker only deviates within the next 3
// undone tasks, never further.

import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import path from 'node:path';

import { db, getMemory, listTasksForPath } from './firebase.js';

const MODEL = 'claude-haiku-4-5-20251001';
const CANDIDATE_WINDOW = 3;

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

const SYSTEM = `You pick the best NEXT learning task for a coach's learner from a list of candidates.

You receive:
- the learner's profile (role, goal, recent strengths, growth_areas, interests, open_threads)
- the next 3 undone tasks in their learning path, in sequence order

Pick the ONE that best fits where they are right now. Default to the sequenced first option unless the brain memory clearly suggests another candidate would land better.

Output ONLY the chosen candidate's number (1, 2, or 3). No words, no explanation.`;

function memoryHasSubstance(memory) {
  if (!memory) return false;
  const counts =
    (memory.interests?.length || 0) +
    (memory.open_threads?.length || 0) +
    (memory.growth_areas?.length || 0) +
    (memory.strengths?.length || 0);
  return counts >= 2;
}

// Returns the next task for a user. If the brain has signal AND Anthropic is
// available, asks Haiku to pick from the next CANDIDATE_WINDOW candidates.
// Falls back to strict sequential.
export async function pickNextTask(user) {
  if (!user.learning_path_id) return null;

  const tasks = await listTasksForPath(user.learning_path_id);
  if (!tasks.length) return null;

  const subSnap = await db()
    .collection('coach_submissions')
    .where('user_id', '==', user.id)
    .get();
  const done = new Set(subSnap.docs.map(d => d.data().task_id));
  const candidates = tasks.filter(t => !done.has(t.id) && t.status !== 'inactive').slice(0, CANDIDATE_WINDOW);

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return { task: candidates[0], reason: 'only_candidate' };

  const memory = await getMemory(user.id).catch(() => null);

  // Default sequential if memory thin or Claude unavailable
  if (!memoryHasSubstance(memory) || !resolveKey()) {
    return { task: candidates[0], reason: 'sequential_default' };
  }

  const memoryBrief = [
    memory.role || user.role ? `Role: ${memory.role || user.role}` : '',
    memory.interests?.length ? `Interests: ${memory.interests.slice(0, 4).join('; ')}` : '',
    memory.open_threads?.length ? `Open threads: ${memory.open_threads.slice(0, 3).map(t => t.topic || t).join('; ')}` : '',
    memory.growth_areas?.length ? `Growth edges: ${memory.growth_areas.slice(0, 3).join('; ')}` : '',
    memory.strengths?.length ? `Recent strengths: ${memory.strengths.slice(0, 2).join('; ')}` : '',
  ].filter(Boolean).join('\n');

  const candidatesBlock = candidates
    .map((t, i) => `${i + 1}. ${t.title} — ${t.lesson_text.slice(0, 200)}`)
    .join('\n\n');

  const userPrompt = `Learner:
- Name: ${user.full_name || 'Learner'}
- Goal: ${user.goal || 'apply AI at work'}

What you know about them:
${memoryBrief}

Next ${candidates.length} candidate tasks (in sequence order):
${candidatesBlock}

Which number? Reply with just 1, 2, or ${candidates.length}.`;

  try {
    const resp = await client().messages.create({
      model:      MODEL,
      max_tokens: 8,
      system:     SYSTEM,
      messages:   [{ role: 'user', content: userPrompt }],
    });
    const txt = (resp.content?.[0]?.text || '').trim();
    const num = parseInt(txt.match(/[123]/)?.[0] || '1', 10);
    const idx = Math.max(0, Math.min(candidates.length - 1, num - 1));
    return {
      task:   candidates[idx],
      reason: idx === 0 ? 'sequential_confirmed' : `picked_${idx + 1}_of_${candidates.length}`,
    };
  } catch (err) {
    console.error('[task-picker] error:', err.message);
    return { task: candidates[0], reason: 'fallback_sequential' };
  }
}
