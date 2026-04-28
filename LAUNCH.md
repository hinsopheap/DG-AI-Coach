# DG AI Coach — Pilot Launch Playbook

For launching to your first 10 trusted learners. Estimated time to first user: 30 minutes once you finish this checklist.

---

## Pre-launch checklist (run once)

### Production health

- [ ] `curl https://dgaicoach.vercel.app/api/health` returns `{ ok: true, app: ok, firestore: ok }`
- [ ] `curl https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo` shows the production webhook + 0 pending + no errors
- [ ] Coach photo loads at https://dgaicoach.vercel.app/coach.jpg
- [ ] `/admin/errors` shows no recent errors (sign in with admin email/password)

### Anthropic budget

- [ ] Top up the [Anthropic billing](https://console.anthropic.com/settings/billing) so balance > $20
- [ ] Set a [usage limit](https://console.anthropic.com/settings/limits) at $50/mo for pilot (well above expected $5–10/mo for 10 active learners)
- [ ] Enable email alert at 75% utilization

### Telegram

- [ ] Bot menu shows 14 commands (run `npm run set-commands` if not)
- [ ] Bot description and short description are set (visible in @dgaicoach_bot's profile)

### Optional but recommended

- [ ] Add `GROQ_API_KEY` to Vercel env if you want voice transcription on Telegram (graceful fallback without)
- [ ] Verify `coach.jpg` portrait shows up on landing page hero

---

## The first 10 learners — who and how

### Profile

Pick people who match these:
- **Active** — currently doing real work where AI would help (CEO, GM, senior manager, founder, head of operations)
- **Forgiving** — they will give you feedback, not just leave silently
- **Diverse** — mix of CEO/GM/professional, mix of industries, at least 2 native Khmer speakers to test the language flow
- **Honest** — will tell you when the coach is wrong (this is how you tighten the prompt)

### Outreach template

Send via WhatsApp / direct DM, not email. Keep it 4 sentences max:

> Hi [Name] — I'm piloting an AI coach I built for working professionals in Cambodia. It's a 5-minute-a-day Telegram bot (or web chat) that helps you actually apply AI to your real work — not just learn about it. Free during the pilot. Want to try it? Just open https://dgaicoach.vercel.app/signup or message @dgaicoach_bot — takes 60 seconds to get going.

### What to expect from them

- 6 will sign up within 48 hours
- 4 will become daily active users in week 1
- 2 will report a bad reply (use it to sharpen the prompt — see weekly review)
- 1 will become an enthusiastic referrer

---

## Weekly review ritual (Friday, 30 minutes)

Block 30 minutes every Friday at 4pm. The compounding work happens here.

### 1. Top-up check (1 min)
- Anthropic balance still positive? If under $5, top up.

### 2. `/admin/errors` (5 min)
- Any errors logged this week? Open each, decide: real bug, transient, or prompt issue.
- If real bug: open a GitHub issue against [hinsopheap/DG-AI-Coach](https://github.com/hinsopheap/DG-AI-Coach).
- If transient (rate limit, timeout): note count, no action.

### 3. `/admin/reports` (10 min)
- Filter "open". For each:
  - Read user's question + coach's reply side by side.
  - **Coach was wrong?** Tighten the system prompt in `lib/coach.js`. Mark fixed.
  - **Coach was borderline?** Mark reviewed, no change.
  - **False flag?** Mark reviewed.
- Goal: report queue back to zero each Friday.

### 4. `/admin/users` + `/admin/activity` (5 min)
- WAU = how many users had ≥1 activity this week? Should be ≥40% of total.
- New signups this week? Note any with empty role/path — repair if needed.
- Streaks dying? Highest streak dropping = engagement signal.

### 5. `/admin` overview (3 min)
- Glance at: total submissions, avg score, paths
- Anything alarming = investigate next week.

### 6. Commit prompt changes (5 min)
- If you tightened the system prompt this week, commit + push.
- Vercel auto-deploys — changes are live in 60 seconds.

### 7. One outbound message (1 min)
- DM one pilot user with a question or check-in. Personal touch retains.

---

## Metrics to watch (first 30 days)

| Metric | Target | Where to find it |
|---|---|---|
| Total users | 10 by day 7, 25 by day 30 | `/admin` |
| WAU | ≥40% of total | `/admin` |
| Submissions/week | ≥3 per active user | `/admin/users` |
| Avg score | ≥6.5/10 | `/admin` |
| Reports/week | <2 (lower = coach is sharp) | `/admin/reports` |
| Errors/week | 0 critical | `/admin/errors` |
| Anthropic spend | <$10/mo | console.anthropic.com |

If any goes red for 2 consecutive weeks: pause new outreach, investigate.

---

## Escalation triggers

### When to roll back a deploy
- Errors page suddenly fills up after a deploy
- A specific report says "the coach is broken in [way X]" from multiple users
- `/api/health` returns 503 for >5 minutes

Roll back via Vercel dashboard → Deployments → previous → Promote to Production.

### When to pause new outreach
- Anthropic balance hit zero (top up first, then resume)
- 5+ open reports from a single deploy (something regressed)
- WAU drops below 25% of total for 2 weeks (something is wrong with the experience)

### When to widen the pilot
- WAU consistently >50% of total for 4 weeks
- Avg score trending up
- At least 2 unsolicited "this is helpful" messages
- Reports queue empty most weeks

Then: open it up to 50 users. Same playbook, no other changes.

---

## Common ops tasks

### A learner is stuck mid-onboarding
Repair via Firestore:
```bash
node --env-file=.env.local -e "
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\\\n/g, '\\n') }) });
const db = admin.firestore();
(async () => {
  await db.collection('coach_users').doc('USER_ID').update({ status: 'active', onboarding_step: 'done' });
  console.log('repaired'); process.exit();
})();
"
```

### A learner asks to delete their data
Per `/privacy` we respond within 7 days.
1. Find user_id from `/admin/users`.
2. Delete from: `coach_users`, `coach_messages`, `coach_submissions`, `coach_summaries`, `coach_activity`, `coach_memory/{userId}`, `coach_reports`.
3. Email them confirmation.

### Coach is confidently wrong about a real fact
1. Open `/admin/reports` to find it.
2. Add the fact to `lib/coach.js` system prompt under "Current Anthropic landscape" or a new ground-truth section.
3. Commit + push. Vercel deploys in 60s.

---

## What's intentionally NOT in v1

These are deferred until pilot signal justifies the build:

- Email-based password reset (Telegram-based reset works for the linked-pairs case)
- Voice transcription on Telegram (works if you add `GROQ_API_KEY`, otherwise graceful fallback)
- Persistent rate limiting (in-memory per-instance is fine for pilot scale)
- Real Sentry / observability stack (`/admin/errors` covers MVP)
- Multi-tenant org hierarchy (pilot is direct learners only)
- Native mobile apps (web works on mobile + Telegram is the mobile UX)
- Payment / pricing (free during pilot)

When pilot grows past ~50 active learners, revisit each.

---

## Contact

For questions, code, or issues: **sopheap.hin@gmail.com** · [github.com/hinsopheap/DG-AI-Coach](https://github.com/hinsopheap/DG-AI-Coach)

Built with Next.js, Firestore, Claude Sonnet 4.6, Anthropic API.
