// scripts/set-webhook.js
// Register the Telegram webhook after deploying to Vercel.
// Usage: node --env-file=.env.local scripts/set-webhook.js

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const base = process.env.PUBLIC_BASE_URL;

  if (!token || !secret || !base) {
    console.error('Need TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, PUBLIC_BASE_URL in env.');
    process.exit(1);
  }

  const url = `${base.replace(/\/$/, '')}/api/telegram/webhook/${secret}`;
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, allowed_updates: ['message', 'callback_query'] }),
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
  if (!data.ok) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
