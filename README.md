# DG AI Coach

> Telegram-first AI coaching for leaders, managers, and professionals — 5 minutes a day to apply AI at work.

Part of the Cambodia AI Group monorepo. Shares the single unified Firestore with the other 4 projects.

## What it does

- **Telegram bot** onboards users, asks for role and goal, assigns a learning path
- **Daily tasks** delivered at 08:00 Asia/Phnom_Penh (Vercel Cron at 01:00 UTC)
- **AI evaluation** scores user submissions against a rubric and returns feedback
- **Ask-the-coach** answers freeform work questions in the user's role context
- **Weekly summaries** (Mondays) covering strengths, gaps, and next focus
- **Admin dashboard** for the team to see users, paths, tasks, and activity

## Firestore collections (prefix `coach_`)

All live alongside the existing 16 collections in the shared project.

| Collection | Purpose |
|---|---|
| `coach_users` | Learner profiles (telegram_id, role, goal, path, streak, onboarding state) |
| `coach_paths` | Learning paths (AI for Leaders / Managers / Professionals) |
| `coach_tasks` | Lessons and prompts sequenced inside a path |
| `coach_rubrics` | Scoring rubrics for task evaluation |
| `coach_submissions` | Learner answers with AI-generated score and feedback |
| `coach_summaries` | Weekly reflection records |
| `coach_activity` | Event log (task delivered, question asked, summary sent…) |

## Deployment

From repo root:

```bash
cd dg-ai-coach
npm install
cp .env.example .env.local   # fill in values
npm run seed                 # install the 3 default paths + 15 seed tasks
npx vercel                   # deploy
```

After deploy, register the Telegram webhook:

```bash
PUBLIC_BASE_URL=https://<your-vercel-url> node scripts/set-webhook.js
```

## Environment variables

Set these in Vercel (and in `.env.local` for local dev):

- Firebase Admin: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- Anthropic: `ANTHROPIC_API_KEY`
- Telegram: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` (any random string)
- Cron: `CRON_SECRET`
- Admin dashboard: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`

## Bot commands

| Command | Effect |
|---|---|
| `/start` | Start or restart onboarding |
| `/today` | Get today's lesson and task |
| `/coach <question>` | Ask the coach anything |
| `/progress` | See streak and scores |
| `/summary` | Force-generate this week's reflection |
| `/help` | List commands |

Any freeform message >120 chars with an active task is treated as a submission.
Shorter messages route to the coach.

## Admin dashboard

Visit `/admin/login` and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

Pages:
- `/admin` — users, WAU, submissions, avg score
- `/admin/users` — list, assign learning paths, export CSV
- `/admin/paths` — learning path inventory
- `/admin/tasks` — tasks grouped by path
- `/admin/activity` — recent event log

## Cron jobs (set in `vercel.json`)

| Path | Schedule (UTC) | What it does |
|---|---|---|
| `/api/cron/daily-tasks` | `0 1 * * *` (08:00 ICT) | Deliver today's task to every active user |
| `/api/cron/weekly-summary` | `0 2 * * 1` (09:00 ICT Mon) | Build & send weekly reflections |

Both require `Authorization: Bearer $CRON_SECRET`. Vercel Cron supplies this automatically when deployed.

## Safety

- Never gives medical, legal, or financial advice (enforced by the coach system prompt)
- Evaluation returns encouraging-but-honest feedback capped at 80 words
- Admin destructive actions require confirmation on the client
- All submissions and feedback write an audit event to `coach_activity`

## Local dev gotcha — empty `ANTHROPIC_API_KEY` in shell

If you see `[AI unavailable — ANTHROPIC_API_KEY not configured]` in dev despite the key being in `.env.local`, the parent shell is exporting an empty `ANTHROPIC_API_KEY` (Claude Code does this for safety). Both Node's `--env-file` and Next.js's dotenv loader refuse to override an existing process.env entry, so the file is silently ignored.

`lib/claude.js` works around this by reading `.env.local` directly when the env var is missing. Vercel deploys are unaffected.

If you want to bypass it manually: `unset ANTHROPIC_API_KEY && npm run dev`.

## Out of scope for v0.1

- Voice transcription (we ACK voice notes but do not yet transcribe)
- Organization manager dashboards
- Billing
- Multi-tenant org hierarchy

See `../CLAUDE.md` for repo-wide conventions.
