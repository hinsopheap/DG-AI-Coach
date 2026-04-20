// lib/claude.js — thin wrapper around the Anthropic SDK for coaching calls.

import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import path from 'node:path';

const MODEL = 'claude-opus-4-7';

// Some dev environments export an empty ANTHROPIC_API_KEY (e.g. when Claude
// Code itself is the parent shell). Node's --env-file and Next.js's dotenv
// both refuse to override an existing process.env entry, so .env.local
// silently loses. Fall back to reading the file directly in that case.
function resolveKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  try {
    const file = path.resolve(process.cwd(), '.env.local');
    if (!fs.existsSync(file)) return null;
    const m = fs.readFileSync(file, 'utf8').match(/^ANTHROPIC_API_KEY=(.+)$/m);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

let client;
function getClient() {
  if (!client) {
    client = new Anthropic({ apiKey: resolveKey() });
  }
  return client;
}

async function complete({ system, user, maxTokens = 1024 }) {
  if (!resolveKey()) {
    return '[AI unavailable — ANTHROPIC_API_KEY not configured]';
  }
  const msg = await getClient().messages.create({
    model:      MODEL,
    max_tokens: maxTokens,
    system,
    messages:   [{ role: 'user', content: user }],
  });
  return msg.content?.[0]?.text?.trim() || '';
}

// ── Ask-the-coach: freeform user question answered in the user's role context ─

export async function askCoach({ question, role, goal, language = 'en', recentTopics = [] }) {
  const system = `You are DG AI Coach, a practical AI coach for working professionals.
You give short, actionable answers that fit on a phone screen.
The user is a ${role || 'professional'}. Their stated learning goal is: "${goal || 'apply AI at work'}".
Reply in ${language === 'km' ? 'Khmer' : 'English'}.
Rules:
- Keep answers under 180 words.
- Prefer bullet points and numbered steps.
- Give one concrete example tied to the user's role.
- Never give medical, legal, or financial advice. Refer to a qualified professional instead.
- End with one short suggested next step.`;

  const recentContext = recentTopics.length
    ? `\n\nRecent coaching topics for this user: ${recentTopics.slice(0, 5).join('; ')}.`
    : '';

  return complete({
    system,
    user: `${question}${recentContext}`,
    maxTokens: 700,
  });
}

// ── Evaluate a submission against a rubric ────────────────────────────────────

export async function evaluateSubmission({ task, rubric, submission, role, language = 'en' }) {
  const criteria = rubric?.criteria_json || [
    { name: 'Clarity', description: 'Is the response clear and well-structured?', weight: 1 },
    { name: 'Relevance', description: 'Does it address the task?', weight: 1 },
    { name: 'Application', description: 'Does it show practical use of AI?', weight: 1 },
  ];
  const maxScore = rubric?.max_score || 10;

  const system = `You are an evaluator for DG AI Coach.
Score the submission on each rubric criterion, using a scale of 0 to ${maxScore}.
Return ONLY valid JSON matching this schema:
{
  "criterion_scores": [{ "name": string, "score": number, "comment": string }],
  "total_score": number,
  "feedback": string,
  "next_action": string
}
Rules:
- Be fair but honest. Average learners score 5–7.
- "feedback" must be ≤ 80 words, encouraging, and in ${language === 'km' ? 'Khmer' : 'English'}.
- "next_action" is one concrete step, ≤ 15 words.
- Return nothing outside the JSON.`;

  const criteriaText = criteria
    .map(c => `- ${c.name} (weight ${c.weight || 1}): ${c.description}`)
    .join('\n');

  const user = `Learner role: ${role || 'professional'}
Task title: ${task.title}
Task prompt: ${task.prompt_text}

Rubric criteria:
${criteriaText}

Submission:
"""
${submission}
"""

Return JSON only.`;

  const raw = await complete({ system, user, maxTokens: 900 });

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('no JSON object found');
    const parsed = JSON.parse(match[0]);
    return {
      criterion_scores: parsed.criterion_scores || [],
      total_score:      Number(parsed.total_score) || 0,
      feedback:         parsed.feedback || '',
      next_action:      parsed.next_action || '',
    };
  } catch (err) {
    console.error('[evaluateSubmission] parse failed:', err.message);
    return {
      criterion_scores: [],
      total_score:      null,
      feedback:         'Thanks for submitting. I could not score this automatically — an admin will review.',
      next_action:      'Continue to your next task.',
      _error:           err.message,
      _raw:             raw,
    };
  }
}

// ── Weekly summary ────────────────────────────────────────────────────────────

export async function generateWeeklySummary({ user, submissions, completionRate, pathTitle }) {
  const system = `You are DG AI Coach writing a concise weekly reflection for a learner.
Keep the whole message under 200 words. Reply in ${user.preferred_language === 'km' ? 'Khmer' : 'English'}.
Output exactly three sections, each 1–2 sentences:
STRENGTHS: what the learner did well this week.
GAPS: where they can grow.
NEXT FOCUS: one clear priority for next week.
Use plain text with section labels in CAPS — no markdown headers, no emojis.`;

  const submissionsText = submissions.length
    ? submissions
        .map(s => `- Task "${s.task_title || s.task_id}" — score ${s.total_score ?? 'n/a'}/10 — ${(s.feedback_text || '').slice(0, 120)}`)
        .join('\n')
    : 'No submissions this week.';

  const user_ = `Learner: ${user.full_name || 'Learner'} (${user.role || 'professional'})
Learning path: ${pathTitle || 'Unassigned'}
Goal: ${user.goal || 'apply AI at work'}
Completion rate this week: ${Math.round((completionRate || 0) * 100)}%
Submissions this week:
${submissionsText}

Write the weekly reflection now.`;

  return complete({ system, user: user_, maxTokens: 500 });
}

// ── Classify a freeform message as task-submission vs coach-question ──────────

export async function classifyMessage(text) {
  if (!text || text.length < 3) return 'noise';
  const trimmed = text.trim();
  if (trimmed.length < 40 && trimmed.endsWith('?')) return 'question';
  // Cheap heuristic first; we avoid a Claude call for short interactions.
  return trimmed.length > 120 ? 'submission' : 'question';
}
