// lib/coach.js — agentic coach turn handler shared by Telegram and Web.
//
// One entry point: coachTurn({ user, surface, text }) -> { reply, suggestions, actions }
//
// The coach has memory (last 20 messages), a proactive system prompt, and a
// small set of tools that let Claude take real actions on the user's behalf:
//   - deliver_today_task
//   - show_progress
//   - record_commitment
//   - submit_task_response
//
// We do NOT round-trip every freeform message through Claude before deciding
// whether it is a submission — Claude itself decides via tools.

import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import path from 'node:path';

import {
  appendMessage,
  listRecentMessages,
  listSubmissionsForUser,
  getNextTaskForUser,
  getRubric,
  getTask,
  getPath,
  createSubmission,
  updateUser,
  logActivity,
  getMemory,
} from './firebase.js';
import { evaluateSubmission } from './claude.js';
import { renderMemoryForPrompt, maybeConsolidate, shouldConsolidate, rememberFact } from './brain.js';

// Sonnet 4.6 is ~3x faster than Opus and strong enough for coaching + tool use.
// Reserve Opus for the offline weekly summary where latency does not matter.
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

// ── Tool schema ───────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'deliver_today_task',
    description:
      'Send the learner the next task in their learning path. Use this when the learner says they want today\'s task, want to start, or asks "what should I do?". Do NOT use if they already received a task and have not responded yet.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'show_progress',
    description:
      'Show the learner their stats: streak, tasks completed, average score. Use when they ask about progress, how they\'re doing, or want a recap.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'record_commitment',
    description:
      'Record that the learner committed to doing something specific (e.g. "I will draft the staff update tomorrow"). The next coach session will reference it.',
    input_schema: {
      type: 'object',
      properties: {
        text:     { type: 'string', description: 'What the learner committed to, in their own words.' },
        due_date: { type: 'string', description: 'YYYY-MM-DD if they specified a date, otherwise omit.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'submit_task_response',
    description:
      'Treat the learner\'s most recent message as their submission for the current task. Use when their message is clearly an attempt at the task they were given (vs. a question about it).',
    input_schema: {
      type: 'object',
      properties: {
        submission_text: { type: 'string', description: 'The full text of the learner submission.' },
      },
      required: ['submission_text'],
    },
  },
  {
    name: 'remember',
    description:
      'Write a fact about the learner to your long-term memory so future sessions carry it. Use when you notice something meaningful about WHO they are, how they work, what they care about, or a specific thing they told you that will matter later. Prefer one short sentence over a paragraph.',
    input_schema: {
      type: 'object',
      properties: {
        category: {
          type:        'string',
          enum:        ['key_facts', 'strengths', 'growth_areas', 'interests'],
          description: 'key_facts for concrete facts about their world; strengths/growth_areas for coaching observations; interests for topics they care about.',
        },
        fact:     { type: 'string', description: 'The short sentence to remember.' },
      },
      required: ['category', 'fact'],
    },
  },
];

// ── Coach personality ─────────────────────────────────────────────────────────

// The system prompt is split into two pieces:
//   stableSystem — large, mostly invariant block (cached for ~5 min)
//   liveContext  — small per-user state (uncached)
// This lets us cache the heavy 1.5KB block across a learner's session.

const STABLE_SYSTEM = `You are DG AI Coach — a senior AI coach for working professionals in Cambodia. You operate at the frontier of practical AI: you have hands-on expertise with current Claude, GPT, and Gemini models, with prompt engineering, with retrieval-augmented generation, with multi-step agents, and with how AI actually fits into real business workflows. You speak about AI the way a top practitioner would — concrete, current, opinionated, never hand-wavy.

## Core stance: decisive, opinionated, not indecisive

You form a clear point of view each turn and state it. A vague, diplomatic, question-only reply is a failure.

- When the learner asks "what should I do?", give a directive: "Do X. Here's why in one line." Don't return a list of three options for them to pick from unless they explicitly asked for options.
- When they share a problem, state what you believe the best next move is before asking anything.
- If you need more information, ask ONE specific question — never a list of three. And only ask if you truly cannot decide without it.
- You are allowed to disagree with the learner. Do so directly and kindly: "I'd push back on that — here's why."
- Do not hedge with "it depends" or "that's a great question". Lead with your answer.

## Your role: orchestrator + supporter + brain

You are not a chatbot. You are a coach with memory and judgment who:
- Uses the memory block below — what you've learned about THIS learner — to tailor every reply
- Designs the next 5-minute move that pushes the learner forward
- Connects what the learner just did to what they should do next
- Picks the right practice surface (chat, exercise, real work)
- Notices wins and names them specifically — people grow when they feel seen
- Notices avoidance gently — names it, removes the friction, suggests a smaller step
- Remembers meaningful things via the \`remember\` tool so future sessions compound

You are warm but never sappy. Direct but never harsh. You believe the learner can do this, and you act like it.

## Memory usage

The prompt below contains what you have learned about this specific learner — their prompt style, strengths, growth edges, open threads, and key facts. Use it actively:
- Reference specific things you remember ("Last time you mentioned the Khmer translation workflow…").
- Match their preferred reply length and style.
- Follow up on open threads when the moment is right — not every turn, but when it's natural.
- When you notice something NEW worth carrying forward (a new project, a strength they just showed, a growth edge you see clearly) — call the \`remember\` tool once with a single crisp sentence. Do this sparingly, only for things that will actually matter later.

## Voice and format

- Use the learner's name occasionally — not every turn.
- Mobile-first: short paragraphs, generous line breaks.
- Use Markdown sparingly: **bold** for emphasis, bullet lists for 3+ items, inline links for resources. Never headers (#).
- Cap responses at ~180 words. Brevity is respect.
- Always end with ONE concrete next move: a directive, a question, a tool call, or a link to practice.

## Practice surfaces you can recommend

When a learner needs to *practice* — not just talk about AI — point them to one of these DG Academy tools and tell them exactly what to try:

- **DG Chat** (https://dgchat.angkorgate.ai) — drop-in AI assistant for daily work. Use when you want them to draft, summarise, translate, or brainstorm.
- **AI Eureka** (https://aieureka.angkorgate.ai) — guided experiments and templates. Use when you want them to learn a specific pattern (RAG, prompt chaining, agents).
- **AI portal** (https://ai.angkorgate.ai) — landing hub with all DG Academy AI tools.

Recommend by name with the URL inline so it renders as a link. Always pair the link with a concrete prompt or scenario to try, e.g. "Open DG Chat and paste this prompt: 'Rewrite the attached email in 50 words for our Khmer warehouse team.'"

## Tools — use them

You have tools that take real actions:
- **deliver_today_task** — when the learner is ready for their next task
- **show_progress** — when they want stats or context on how they're doing
- **record_commitment** — when they say they'll do something later (write it down)
- **submit_task_response** — when their message IS their attempt at the current task
- **remember** — write a one-sentence fact to your long-term memory

Use tools liberally. Do not ask permission — just call them when appropriate.

## Operating principles

- Lead with a point of view. Question-only replies are failures.
- Drive forward. Prefer "Do this right now: ..." over "You could consider...".
- One clarifying question max, and only when needed.
- If the learner is stuck, shrink the next step until it takes 5 minutes.
- If the learner finishes something, name one specific strength, then propose what is next.

## Hard rules

- Never give medical, legal, or financial advice — refer to a qualified professional.
- Never claim to be human.
- Never invent tasks the learner has not been given via the tools.
- Never recommend tools outside DG Academy unless the learner asks for an external comparison.`;

function buildLiveContext(user, ctx) {
  const lang = user.preferred_language === 'km' ? 'Khmer' : 'English';
  const role = user.role || 'professional';
  const goal = user.goal || 'apply AI at work';
  const streak = user.streak_count || 0;
  const path = ctx.pathTitle || 'Unassigned';
  const lastTask = ctx.currentTask?.title || 'none in progress';
  const recent = ctx.recentSubmissions
    ?.slice(0, 3)
    .map(s => `  • ${s.task_title || s.task_id} — ${s.total_score ?? '?'}/10`)
    .join('\n') || '  (no submissions yet)';

  const memoryBlock = renderMemoryForPrompt(ctx.memory);

  return `## Learner context (changes per turn)

- Name: ${user.full_name || 'Learner'}
- Role: ${role}
- Goal: "${goal}"
- Learning path: ${path}
- Current task in progress: ${lastTask}
- Streak: ${streak} day${streak === 1 ? '' : 's'}
- Recent submissions:
${recent}

Reply in ${lang}. If the learner has a current task they have not submitted, gently surface it when relevant.

${memoryBlock}`;
}

// ── Tool executors (run server-side) ──────────────────────────────────────────

async function execDeliverTask({ user }) {
  const task = await getNextTaskForUser(user);
  if (!task) {
    return { ok: false, message: 'The learner has finished their learning path. No more tasks queued.' };
  }
  await updateUser(user.id, {
    last_task_id:   task.id,
    last_task_date: new Date().toISOString().slice(0, 10),
  });
  await logActivity(user.id, 'task_delivered', { task_id: task.id, via: 'coach_tool' });

  const lessonText = `📚 ${task.title}

${task.lesson_text}

✍️ Your task:
${task.prompt_text}`;

  return { ok: true, deliver_to_user: lessonText, task_id: task.id, task_title: task.title };
}

async function execShowProgress({ user }) {
  const subs = await listSubmissionsForUser(user.id, { limit: 30 });
  const path = user.learning_path_id ? await getPath(user.learning_path_id) : null;
  const scores = subs.map(s => s.total_score).filter(s => typeof s === 'number');
  const avg = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10
    : null;

  const card = `📈 Your progress
Path: ${path?.title || '—'}
Tasks completed: ${subs.length}
Average score: ${avg != null ? avg + '/10' : '—'}
Current streak: ${user.streak_count || 0} days`;

  return { ok: true, deliver_to_user: card, completed: subs.length, average: avg, streak: user.streak_count || 0 };
}

async function execRecordCommitment({ user, text, due_date }) {
  await logActivity(user.id, 'commitment', { text, due_date: due_date || null });
  return { ok: true, message: `Recorded commitment: "${text}"${due_date ? ' due ' + due_date : ''}` };
}

async function execSubmitTaskResponse({ user, submission_text }) {
  if (!user.last_task_id) {
    return { ok: false, message: 'No task is currently in progress. Deliver a task first.' };
  }
  const task = await getTask(user.last_task_id);
  if (!task) return { ok: false, message: 'Current task not found.' };

  const rubric = task.rubric_id ? await getRubric(task.rubric_id) : null;
  const result = await evaluateSubmission({
    task,
    rubric,
    submission: submission_text,
    role:       user.role,
    language:   user.preferred_language,
  });

  await createSubmission({
    user_id:         user.id,
    task_id:         task.id,
    submission_type: 'text',
    submission_text,
    score_json:      result.criterion_scores,
    total_score:     result.total_score,
    feedback_text:   result.feedback,
  });

  // Streak update
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  let newStreak = 1;
  if (user.last_completion_date === today) newStreak = user.streak_count || 1;
  else if (user.last_completion_date === yesterday) newStreak = (user.streak_count || 0) + 1;

  await updateUser(user.id, {
    streak_count:         newStreak,
    last_completion_date: today,
    last_task_id:         null, // clear so suggestions/tools advance to next task
  });
  // Keep the in-memory user object in sync for the rest of this turn
  user.streak_count = newStreak;
  user.last_completion_date = today;
  user.last_task_id = null;
  await logActivity(user.id, 'task_submitted', {
    task_id: task.id,
    score:   result.total_score,
    via:     'coach_tool',
  });

  return {
    ok:         true,
    score:      result.total_score,
    feedback:   result.feedback,
    next_step:  result.next_action,
    streak:     newStreak,
  };
}

async function execRemember({ user, category, fact }) {
  await rememberFact(user.id, category, fact);
  return { ok: true, message: `Noted: "${fact}"` };
}

const TOOL_EXEC = {
  deliver_today_task:   execDeliverTask,
  show_progress:        execShowProgress,
  record_commitment:    execRecordCommitment,
  submit_task_response: execSubmitTaskResponse,
  remember:             execRemember,
};

// ── Build context the system prompt cares about ───────────────────────────────

async function buildContext(user) {
  const [submissions, path, currentTask, memory] = await Promise.all([
    listSubmissionsForUser(user.id, { limit: 5 }),
    user.learning_path_id ? getPath(user.learning_path_id) : null,
    user.last_task_id ? getTask(user.last_task_id) : null,
    getMemory(user.id),
  ]);

  for (const s of submissions) {
    if (s.task_id && !s.task_title) {
      const t = await getTask(s.task_id);
      s.task_title = t?.title;
    }
  }

  return {
    pathTitle:         path?.title,
    currentTask,
    recentSubmissions: submissions,
    memory,
  };
}

// ── Main entry point ──────────────────────────────────────────────────────────
//
// Returns { reply, deliveries, suggestions, error? }
//   reply        — string for the surface to render as the assistant message
//   deliveries   — array of strings the coach actively pushed (tool outputs)
//   suggestions  — quick replies for the surface to show as buttons

// attachments: [{ type: 'image', media_type: 'image/jpeg', data: '<base64>' }]
export async function coachTurn({ user, surface, text, attachments = [] }) {
  if (!resolveKey()) {
    return { reply: 'Coach is unavailable — ANTHROPIC_API_KEY is not configured.', deliveries: [], suggestions: [] };
  }

  // Persist the inbound message before we do anything else. We store a marker
  // for attachments rather than the full base64 (Firestore docs are 1MB max).
  const persistedText = attachments.length
    ? `${text || ''}\n\n_[attached ${attachments.length} image${attachments.length > 1 ? 's' : ''}]_`.trim()
    : text;
  await appendMessage(user.id, { role: 'user', text: persistedText, surface });

  const [ctx, history] = await Promise.all([
    buildContext(user),
    listRecentMessages(user.id, { limit: 20 }),
  ]);

  // Convert history into Claude messages format. Strip the attachment marker
  // from the most recent user message — we'll inject the real image blocks
  // for that turn below.
  const messages = history
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({ role: m.role, content: m.text || '' }))
    .filter(m => m.content);

  // If this turn has attachments, replace the last user message's content
  // with multimodal blocks (image(s) + text).
  if (attachments.length && messages.length) {
    const last = messages[messages.length - 1];
    if (last.role === 'user') {
      const blocks = attachments.map(a => ({
        type: 'image',
        source: { type: 'base64', media_type: a.media_type || 'image/jpeg', data: a.data },
      }));
      if (text) blocks.push({ type: 'text', text });
      else blocks.push({ type: 'text', text: 'What do you see, and what should I do with this?' });
      last.content = blocks;
    }
  }

  // Two-block system: stable (cached) + per-turn live context.
  const system = [
    { type: 'text', text: STABLE_SYSTEM, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: buildLiveContext(user, ctx) },
  ];

  // Cap at 2 tool-call rounds for latency. The first round runs tools, the
  // second produces the final text. More rounds rarely help and add seconds.
  const deliveries = [];
  let assistantText = '';
  let lastResponse = null;

  for (let round = 0; round < 2; round++) {
    const resp = await client().messages.create({
      model:      MODEL,
      max_tokens: 700,
      system,
      tools:      TOOLS,
      messages,
    });
    lastResponse = resp;

    // Collect any text + tool_use blocks
    const textBlocks = [];
    const toolUses = [];
    for (const block of resp.content) {
      if (block.type === 'text') textBlocks.push(block.text);
      if (block.type === 'tool_use') toolUses.push(block);
    }

    if (textBlocks.length) assistantText = textBlocks.join('\n').trim();

    if (resp.stop_reason !== 'tool_use' || !toolUses.length) {
      break;
    }

    // Append assistant turn (with tool_use blocks intact) to messages so we can
    // attach tool_result blocks for the next round.
    messages.push({ role: 'assistant', content: resp.content });

    const toolResults = [];
    for (const tu of toolUses) {
      const exec = TOOL_EXEC[tu.name];
      let result;
      try {
        result = exec ? await exec({ user, ...(tu.input || {}) }) : { ok: false, message: 'Unknown tool' };
      } catch (err) {
        result = { ok: false, message: err.message };
      }

      if (result?.deliver_to_user) {
        deliveries.push(result.deliver_to_user);
      }

      toolResults.push({
        type:        'tool_result',
        tool_use_id: tu.id,
        content:     JSON.stringify(result),
      });
    }

    messages.push({ role: 'user', content: toolResults });
  }

  // Persist assistant turn
  if (assistantText || deliveries.length) {
    await appendMessage(user.id, {
      role:    'assistant',
      text:    assistantText,
      surface,
      tool_calls: deliveries.length ? deliveries.map((_, i) => `delivery_${i}`) : null,
    });
  }

  // Build suggestions — keep simple: 2-3 useful next moves based on user state.
  const suggestions = buildSuggestions(user, ctx);

  // Consolidate the brain every few turns. Cheap check first — only the
  // actual consolidation (a Haiku call) is slow, and it's triggered
  // infrequently so the amortised cost per turn is small.
  if (shouldConsolidate({ memory: ctx.memory, messageCount: history.length + 1 })) {
    await maybeConsolidate(user, { memory: ctx.memory, messageCount: history.length + 1 });
  }

  return {
    reply:       assistantText,
    deliveries,
    suggestions,
  };
}

function buildSuggestions(user, ctx) {
  const out = [];
  if (user.last_task_id && ctx.currentTask) {
    out.push('Submit my answer');
    out.push('Help with this task');
  } else {
    out.push('Today\'s task');
  }
  out.push('My progress');
  if (out.length < 3) out.push('I have a question');
  return out.slice(0, 3);
}
