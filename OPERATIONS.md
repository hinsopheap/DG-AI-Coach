# DG AI Coach — Operations Runbook

Day-to-day ops for the production deployment at **https://dgaicoach.vercel.app** with Telegram bot **@dgaicoach_bot**.

---

## Healthchecks

```bash
curl -s https://dgaicoach.vercel.app/api/health | jq
# expects: { ok: true, checks: { app: "ok", firestore: "ok" } }
```

If `firestore` shows `fail`, check Firebase status and the FIREBASE_PRIVATE_KEY env var.

Telegram webhook status:
```bash
curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo" | jq .result
```
- `pending_update_count` should stay near 0
- `last_error_message` should be `null`

---

## Deploy

```bash
cd dg-ai-coach
git pull origin main
vercel deploy --prod --yes
# Then re-alias to the canonical domain:
vercel alias set <new-deployment-url> dgaicoach.vercel.app
```

After deploy, refresh Telegram metadata (one-time per change to commands or webhook secret):
```bash
npm run set-commands   # registers /today, /dashboard, /profile, etc
npm run set-webhook    # only if PUBLIC_BASE_URL or TELEGRAM_WEBHOOK_SECRET changed
```

---

## Environment variables (Vercel production)

| Name | Notes |
|---|---|
| `FIREBASE_PROJECT_ID` | `cambodia-ai-group` |
| `FIREBASE_CLIENT_EMAIL` | service account email |
| `FIREBASE_PRIVATE_KEY` | wrap in `"..."`, keep `\n` escapes |
| `ANTHROPIC_API_KEY` | rotate quarterly |
| `TELEGRAM_BOT_TOKEN` | from @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | random hex; rotate on key compromise |
| `CRON_SECRET` | `Authorization: Bearer ...` for /api/cron/* |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | rotate password every 90 days |
| `ADMIN_SESSION_SECRET` | HMAC for admin cookies |
| `PUBLIC_BASE_URL` | `https://dgaicoach.vercel.app` |

Rotation: change in Vercel dashboard → redeploy. Rotation requires no code change.

---

## Cron jobs

Configured in `vercel.json`:

| Path | Schedule (UTC) | Local time (Phnom Penh, UTC+7) | Purpose |
|---|---|---|---|
| `/api/cron/daily-tasks` | `0 1 * * *` | 08:00 | Deliver daily task to all active learners |
| `/api/cron/weekly-summary` | `0 2 * * 1` | 09:00 Mon | Generate weekly reflection per learner |

Verify last run via the activity log in Firestore (`coach_activity` where `event_type=task_delivered`) or Vercel's cron logs in the dashboard.

Manual trigger (local):
```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://dgaicoach.vercel.app/api/cron/daily-tasks
```

---

## Common tasks

### Reset a stuck learner
If a user is frozen mid-onboarding (status: `onboarding`, step ≠ `done`):
```bash
node --env-file=.env.local -e "
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert({ projectId: process.env.FIREBASE_PROJECT_ID, clientEmail: process.env.FIREBASE_CLIENT_EMAIL, privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\\\n/g, '\\n') }) });
const db = admin.firestore();
(async () => {
  const ref = db.collection('coach_users').doc('USER_ID');
  await ref.update({ status: 'active', onboarding_step: 'done' });
  console.log('repaired');
  process.exit();
})();
"
```

### Wipe a learner's brain memory
Admin → click any user → "Reset memory" button.
Or via API: `POST /api/admin/reset-memory { user_id }` while signed in as admin.

### Force-deliver today's task to one learner
Admin can flip `last_task_id` to null on the user doc; next `/today` will serve a fresh task.

---

## Rate limits (in-memory, per Vercel instance)

| Endpoint | Limit | Window |
|---|---|---|
| `/api/chat/send` | 30 | 1 min |
| `/api/auth/signup` | 5 | 5 min |
| `/api/auth/signin` | 10 | 5 min |
| `/api/admin/*` | (no limit; admin auth required) | — |
| `/api/telegram/webhook/[secret]` | (no limit; secret-protected) | — |

Upgrade to Upstash Rate Limit if abuse becomes cross-instance.

---

## Incident response

**Symptom: Coach replies "AI unavailable"**
- Check `ANTHROPIC_API_KEY` in Vercel.
- Check Anthropic API status: https://status.anthropic.com
- The coach has a graceful fallback that returns a neutral message — users won't see a crash.

**Symptom: Telegram bot silent**
1. `getWebhookInfo` — is the webhook URL correct? `last_error_message`?
2. If wrong URL: `npm run set-webhook` from local with `PUBLIC_BASE_URL` set.
3. If 5xx on /api/telegram/webhook/<secret>: redeploy.

**Symptom: 503 on /api/health**
- Firebase Admin SDK can't connect — usually env-var issue.
- Verify `FIREBASE_PRIVATE_KEY` still has `\n` escapes wrapped in quotes.

**Symptom: Web users see "You are already set up" on every message**
- The `isOnboarding` guard treats `status` as canonical. If user's status is `onboarding` but step is `done`, run the "Reset a stuck learner" snippet above.

---

## Privacy + data subject requests

If a user asks for their data or asks to be deleted:
- Email: `sopheap.hin@gmail.com`
- Within 7 days, run a Firestore query for their email + delete from:
  - `coach_users` (the doc)
  - `coach_messages` (where user_id matches)
  - `coach_submissions`, `coach_summaries`, `coach_activity`, `coach_memory/{userId}`
- Confirm via email reply.

---

## Pilot metrics to watch (weekly)

In `/admin`:
- Total users
- Weekly active users
- Total submissions
- Average score
- Achievements unlocked / total

If WAU drops below 30% of total users for 2 weeks, the daily-tasks cron may have stopped, or copy is failing. Investigate.
