// seed/seed.js
// Seeds DG AI Coach with the 3 default learning paths and a basic rubric.
// Safe to re-run: uses deterministic document IDs.
// Run with: node --env-file=.env.local seed/seed.js

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}
const db = admin.firestore();
const now = admin.firestore.FieldValue.serverTimestamp();

const RUBRICS = [
  {
    id:        'rubric_default_v1',
    title:     'Default practical-application rubric',
    max_score: 10,
    criteria_json: [
      { name: 'Relevance',   description: 'Answer addresses the task and role context', weight: 1 },
      { name: 'Specificity', description: 'Includes concrete examples or steps, not generalities', weight: 1 },
      { name: 'Application', description: 'Shows practical use of AI in real work', weight: 1 },
    ],
  },
];

const PATHS = [
  {
    id:          'path_leaders_v1',
    title:       'AI for Leaders',
    target_role: 'ceo',
    description: 'Five-minute daily reps to use AI for strategic decisions, communications, and team leadership.',
    status:      'active',
    tasks: [
      {
        title:      'Spot 3 AI opportunities in your business',
        lesson_text:'AI adoption starts by naming the boring, repetitive work your team does each week. Those are the best starting points.',
        prompt_text:'List 3 repeating tasks inside your company where AI could save time. For each, write one sentence on who does it today.',
      },
      {
        title:      'Write an AI-first staff update',
        lesson_text:'Clear weekly updates drive alignment. AI can turn a rough bullet list into a polished message in minutes.',
        prompt_text:'Draft a 5-bullet staff update for this week (wins, risks, priorities). Share what you wrote.',
      },
      {
        title:      'Run a 15-minute AI strategy sprint',
        lesson_text:'Leaders get stuck because they think in whole quarters. Ask AI to pressure-test a single bet in 15 minutes.',
        prompt_text:'Pick one bet your company is making this quarter. Write the bet, your assumption, and the first thing you will test.',
      },
      {
        title:      'Delegate one task to AI this week',
        lesson_text:'Delegation is the highest-leverage AI habit for leaders. You do not need a new tool — ChatGPT, Claude, or Gemini will do.',
        prompt_text:'Pick one task on your calendar this week that AI will do a first draft of. Describe the task and the draft you expect.',
      },
      {
        title:      'Brief your GM on AI expectations',
        lesson_text:'AI adoption fails when leaders do not set direction. A one-paragraph brief to your GM unlocks more than any training.',
        prompt_text:'Write a 5-sentence brief to your GM about how you want AI used by the team over the next 90 days.',
      },
    ],
  },
  {
    id:          'path_managers_v1',
    title:       'AI for Managers',
    target_role: 'gm',
    description: 'Daily loops to coach your team, run operations, and report progress using AI.',
    status:      'active',
    tasks: [
      {
        title:      'Map your team’s weekly output',
        lesson_text:'Before optimising with AI, list what your team actually ships each week. Most managers cannot do this from memory.',
        prompt_text:'List the 5 most important outputs your team produces weekly. Beside each, note who owns it and how long it takes.',
      },
      {
        title:      'Turn a meeting into action items with AI',
        lesson_text:'AI is best at converting raw notes into crisp action items. This is the fastest manager win.',
        prompt_text:'Paste rough notes from a recent team meeting, then list the 3 action items you would pull out. (Practice without AI, then compare.)',
      },
      {
        title:      'Draft a performance nudge for one team member',
        lesson_text:'Coaching improves with specificity. AI is great at rewriting vague feedback into a short, kind, direct nudge.',
        prompt_text:'Write one line of feedback you would give a team member this week. Keep it specific and actionable.',
      },
      {
        title:      'Build a weekly AI check-in ritual',
        lesson_text:'A standing "AI win of the week" share-out compounds adoption faster than any training module.',
        prompt_text:'Design a 10-minute weekly ritual where your team shares one AI win. Describe when, where, and what each person brings.',
      },
      {
        title:      'Write the monthly team report with AI assistance',
        lesson_text:'Managers spend hours on reports. AI can draft 80% from your raw notes. Your edits make the last 20% shine.',
        prompt_text:'Share 5 bullet points from this month (wins, blockers, next focus). Outline how you would structure the final report.',
      },
    ],
  },
  {
    id:          'path_professionals_v1',
    title:       'AI for Professionals',
    target_role: 'professional',
    description: 'Practical reps to use AI as a thinking partner for your day-to-day work.',
    status:      'active',
    tasks: [
      {
        title:      'Pick your first AI tool',
        lesson_text:'One tool, used daily, beats five tools used occasionally. Start with whichever is free and loads fast on your phone.',
        prompt_text:'Name the AI tool you will use this week and the one task you will do with it daily.',
      },
      {
        title:      'Rewrite an email in half the words',
        lesson_text:'Brevity is a superpower at work. AI can cut an email in half while keeping the tone right.',
        prompt_text:'Paste the last email you sent (>100 words) and rewrite it as 50 words. Share the before and after.',
      },
      {
        title:      'Generate 10 ideas for your next deliverable',
        lesson_text:'AI is great at ideation. Ask for 10 ideas, pick the top 3, ignore the rest. Throwaway work is fine.',
        prompt_text:'Pick a current deliverable. List 3 working ideas you already have. We will compare against AI’s 10.',
      },
      {
        title:      'Summarise a long document with AI',
        lesson_text:'Most reports can be understood from a 100-word summary. Practice summarising before you read fully — your comprehension will improve.',
        prompt_text:'Pick a document you need to read this week. In 3 sentences, predict what the main conclusion will be.',
      },
      {
        title:      'Share your AI workflow with a colleague',
        lesson_text:'Teaching is the fastest way to lock in learning. Walk a colleague through one AI trick this week.',
        prompt_text:'Name one colleague who would benefit from your AI workflow. Write a 3-sentence pitch for why it would help them.',
      },
    ],
  },
];

async function seed() {
  console.log('→ Seeding rubrics...');
  for (const r of RUBRICS) {
    await db.collection('coach_rubrics').doc(r.id).set({
      title:         r.title,
      max_score:     r.max_score,
      criteria_json: r.criteria_json,
      created_at:    now,
    }, { merge: true });
  }

  console.log('→ Seeding paths and tasks...');
  for (const path of PATHS) {
    await db.collection('coach_paths').doc(path.id).set({
      title:       path.title,
      target_role: path.target_role,
      description: path.description,
      status:      path.status,
      created_at:  now,
    }, { merge: true });

    for (let i = 0; i < path.tasks.length; i++) {
      const t = path.tasks[i];
      const taskId = `${path.id}__task_${String(i + 1).padStart(2, '0')}`;
      await db.collection('coach_tasks').doc(taskId).set({
        learning_path_id: path.id,
        title:            t.title,
        lesson_text:      t.lesson_text,
        prompt_text:      t.prompt_text,
        task_type:        t.task_type || 'application',
        difficulty_level: t.difficulty_level || 'beginner',
        rubric_id:        'rubric_default_v1',
        sequence_order:   i + 1,
        status:           'active',
        created_at:       now,
      }, { merge: true });
    }
    console.log(`   ✓ ${path.title} (${path.tasks.length} tasks)`);
  }

  console.log('\n✓ Seeding complete.');
}

seed().then(() => process.exit(0)).catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
