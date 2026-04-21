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

const DOMAIN_PATHS = [
  {
    id:          'path_communication_v1',
    title:       'AI for Communication',
    target_role: 'any',
    description: 'Write, present, and have hard conversations faster and better — with AI as your drafting partner.',
    status:      'active',
    tasks: [
      { title: 'Rewrite one message for three audiences',
        lesson_text: 'Same content, different voice. A strong leader can say the same thing three ways: to a board, to their team, to a customer. AI makes this 5 minutes, not 30.',
        prompt_text: 'Pick one message you sent this week. Describe the core point in one sentence. We will produce 3 versions together.' },
      { title: 'Meeting notes → decisions',
        lesson_text: 'Meetings without extracted decisions are wasted meetings. Paste raw notes and use AI to surface the decisions, owners, and open questions.',
        prompt_text: 'Share 10 lines of rough notes from a recent meeting. I will extract the 3 decisions and 3 open questions with you.' },
      { title: 'Draft the hard message',
        lesson_text: 'A performance gap, a price increase, a delay, a no. These messages fail when we delay them or soften them into vagueness. Draft kind + direct + under 100 words.',
        prompt_text: 'Name one hard message you need to send this week. Write a first draft in 3 sentences. We will sharpen it.' },
      { title: 'Presentation outline in 5 minutes',
        lesson_text: 'The outline is 80% of the presentation. Get the skeleton right with AI, then spend your time on the 2-3 slides that matter.',
        prompt_text: 'Describe a 15-minute talk you need to give. Audience, goal, constraint. AI + you → 3 sections, key points, slide titles.' },
      { title: 'Culturally tuned Khmer translation',
        lesson_text: 'Translation is register, not just words. A Western-toned memo translated literally into Khmer reads as cold or foreign. AI gets you 80% there; you tune the 20%.',
        prompt_text: 'Paste or describe a short English memo meant for Cambodian staff. We will translate it with the right register.' },
    ],
  },
  {
    id:          'path_decisions_v1',
    title:       'AI for Decisions',
    target_role: 'any',
    description: 'Think clearly, pressure-test faster, and avoid the biases that make decisions go wrong.',
    status:      'active',
    tasks: [
      { title: 'Pre-mortem a decision',
        lesson_text: 'Before you commit, imagine it failed. Why? Write the top 3 failure modes and one mitigation each. AI is the perfect devil\'s advocate for this.',
        prompt_text: 'State a decision you\'re about to make. We will list the top 3 ways it fails and your mitigation for each.' },
      { title: 'Devil\'s advocate on your strongest argument',
        lesson_text: 'If your best argument survives a real attack, commit. If it doesn\'t, find out now, not in the boardroom.',
        prompt_text: 'Paste your strongest argument for a current plan. I will attack it. We will see which attacks land.' },
      { title: 'Pressure-test a hire',
        lesson_text: 'You\'re 80% sure about a candidate. That 20% is where bad hires live. Use AI to surface what you\'re downplaying.',
        prompt_text: 'Describe a candidate you\'re considering (role, experience, strengths). Ask for the 3 risks you\'re likely underweighting.' },
      { title: 'Prioritisation in 10 minutes',
        lesson_text: 'Most overloaded operators fail at prioritisation because they keep re-thinking the same stuff. Write the list once, classify once, move.',
        prompt_text: 'List 8 things on your plate this week. We will classify each: urgent-important, important-not-urgent, delegate, or drop.' },
      { title: 'Cost of waiting',
        lesson_text: 'Most delayed decisions cost more in drag than the wrong choice would cost. Quantify the drag to unlock yourself.',
        prompt_text: 'Pick a decision you\'ve delayed 2+ weeks. Estimate the cost of 30 more days of delay vs. deciding tomorrow.' },
    ],
  },
  {
    id:          'path_operations_v1',
    title:       'AI for Operations',
    target_role: 'any',
    description: 'Redesign weekly workflows to save hours. Template, automate, and measure what matters.',
    status:      'active',
    tasks: [
      { title: 'Map a weekly workflow',
        lesson_text: 'You can\'t optimise what you haven\'t written down. Start by mapping one workflow step-by-step. Then mark what a machine could do.',
        prompt_text: 'Write the 5-step process for one repeating weekly task. For each step, who does it and how long?' },
      { title: 'Template that saves an hour a week',
        lesson_text: 'The best AI habit is turning a one-off output into a re-usable template. Aim for 60 minutes of weekly savings from this single exercise.',
        prompt_text: 'Pick one output you produce weekly (report, update, check-in). We will build the reusable template together.' },
      { title: 'Automate a monthly report',
        lesson_text: 'Reports are structured enough that AI eats 80% of the work. Restructure yours as a prompt template you can re-run monthly.',
        prompt_text: 'Describe your monthly report: sections, data sources, audience. We will convert it into a reusable AI workflow.' },
      { title: 'Inbox triage protocol',
        lesson_text: 'Most email stress is decision fatigue, not volume. A 3-tier triage rule collapses 40 mails into 3 categories of response.',
        prompt_text: 'Describe your typical inbox: 3-5 email types you see most. We will design the triage rule + response templates.' },
      { title: 'One-line KPI',
        lesson_text: 'If you can\'t state your lead metric in 10 words, you don\'t have one. AI helps you compress fuzzy thinking into a sentence.',
        prompt_text: 'What is the ONE metric that, if it moved, your month was a win? Write it in 10 words.' },
    ],
  },
  {
    id:          'path_people_v1',
    title:       'AI for People',
    target_role: 'any',
    description: 'Run better 1:1s, delegate cleanly, give specific feedback, and develop your team.',
    status:      'active',
    tasks: [
      { title: '1:1 prep in 5 minutes',
        lesson_text: 'A good 1:1 is 80% prep. AI can draft specific questions based on what you know about the person — much sharper than improvising.',
        prompt_text: 'Pick one person you\'ll have a 1:1 with this week. Describe their current growth edge. We will write 3 targeted questions.' },
      { title: 'Delegation memo',
        lesson_text: 'Vague delegation = re-work. A one-page brief with goal, constraints, autonomy level, and check-ins prevents 90% of the mess.',
        prompt_text: 'Pick one task to delegate. Answer: goal? deadline? constraints? autonomy level? We will write the brief together.' },
      { title: 'Feedback in 4 sentences',
        lesson_text: 'Good feedback names a specific behaviour, its impact, and what to keep doing. AI helps you compress without softening.',
        prompt_text: 'Pick one person whose work deserves feedback this week. What did they do? We will write the 4-sentence version.' },
      { title: '90-day development plan for one direct',
        lesson_text: 'Career development happens when managers commit to 3 focus areas and hold the loop. AI makes drafting this a 10-minute task.',
        prompt_text: 'Pick one direct report. Their role, tenure, current gap. We will draft a 90-day plan: 3 focus areas, 1 action each.' },
      { title: 'Team meeting agenda that ships decisions',
        lesson_text: 'A team meeting without decisions is theatre. Design the agenda around the 2-3 decisions that need to be made.',
        prompt_text: 'Pick your next team meeting. What 2-3 decisions must come out of it? We will design the 30-minute agenda.' },
    ],
  },
  {
    id:          'path_strategy_v1',
    title:       'AI for Strategy',
    target_role: 'any',
    description: 'Sharpen your bets, kill what isn\'t compounding, and make the next 6 weeks count.',
    status:      'active',
    tasks: [
      { title: 'One-sentence strategy',
        lesson_text: 'If you can\'t state your strategy in one sentence — who you serve, what you do for them, how you win — you don\'t have one yet.',
        prompt_text: 'Write your current strategy in one sentence, no jargon. I\'ll pressure-test it and help you sharpen it.' },
      { title: 'Three bets for the quarter',
        lesson_text: 'A quarter without declared bets drifts. Name the 3 things that, if they worked, the quarter was won. Name the assumption behind each.',
        prompt_text: 'Pick 3 bets for this quarter. For each: assumption, test to validate, what yes looks like. 5-min sprint.' },
      { title: 'Competitor scan',
        lesson_text: 'Most competitor analysis is noise. AI helps you extract what each competitor is actually BETTING on — and where you\'re different.',
        prompt_text: 'Name 3 of your top competitors. We will surface what each is betting on and where you are distinct.' },
      { title: 'Kill a project',
        lesson_text: 'Nothing kills compounding like projects that refuse to die. Pick one and practise killing it cleanly.',
        prompt_text: 'Pick a project that has consumed >10 hrs/month for 3+ months without compounding. We will write how you kill it.' },
      { title: '6-week sprint plan',
        lesson_text: 'Quarters are too long, sprints are too short. Six weeks is the sweet spot — long enough to ship, short enough to stay focused.',
        prompt_text: 'Scope a real 6-week project: outcomes, weekly milestones, kill criteria, one success metric.' },
    ],
  },
  {
    id:          'path_responsible_ai_v1',
    title:       'Responsible AI in Practice',
    target_role: 'any',
    description: 'Use AI ethically, protect your data, spot bias, and keep humans accountable for high-stakes decisions.',
    status:      'active',
    tasks: [
      { title: 'What data should NEVER go into a consumer AI',
        lesson_text: 'Not all AI tools are private. Customer data, employee data, contracts, salary info, passwords, and IP need enterprise-grade tools or redaction — not free ChatGPT.',
        prompt_text: 'List 5 types of data in YOUR business that should never go into a public AI tool. For each, what\'s the safer alternative?' },
      { title: 'Your team\'s AI disclosure policy',
        lesson_text: 'People lose trust when they find out something was AI-written and wasn\'t disclosed. Set the norm now so you don\'t manage it later.',
        prompt_text: 'Draft a 3-line policy for your team: when to disclose AI use, when it doesn\'t matter, examples of each.' },
      { title: 'Bias check on a decision',
        lesson_text: 'The single most useful debiasing question: "Who does this systematically disadvantage?" Run a recent decision through AI with exactly that prompt.',
        prompt_text: 'Pick a recent decision with people implications (hiring criteria, promotion rubric, pricing). We will ask the bias question together.' },
      { title: 'Source verification habit',
        lesson_text: 'AI hallucinates citations. The habit: never use an AI-generated statistic or quote without finding the primary source. If there isn\'t one, treat it as a hypothesis.',
        prompt_text: 'Pick one AI-generated claim you recently trusted or shared. Find the primary source. If none, note it and reconsider.' },
      { title: 'Team AI agreement in 5 rules',
        lesson_text: 'Rules make freedom. Five agreed rules prevent 90% of the team-level AI mistakes: quality, disclosure, data, review, escalation.',
        prompt_text: 'Draft 5 ground rules for how your team uses AI: quality bar, disclosure, data boundaries, review, escalation. One sentence each.' },
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
  const ALL_PATHS = [...PATHS, ...DOMAIN_PATHS];
  for (const path of ALL_PATHS) {
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
