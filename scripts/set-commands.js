// scripts/set-commands.js
// Registers the bot command menu (the "/" hamburger in Telegram) so learners
// see the full list of coaching actions one tap away.
//
// Run: node --env-file=.env.local scripts/set-commands.js

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) { console.error('TELEGRAM_BOT_TOKEN missing'); process.exit(1); }

const COMMANDS = [
  { command: 'today',    description: '📚 Get today\'s 5-minute task' },
  { command: 'progress', description: '📈 See your streak and scores' },
  { command: 'history',  description: '🕐 Show your recent coaching messages' },
  { command: 'web',      description: '💻 Open the web chat (linked to this account)' },
  { command: 'summary',  description: '🗓 This week\'s reflection' },
  { command: 'practice', description: '🎯 Open a DG Academy practice tool' },
  { command: 'help',     description: '❓ How to use DG AI Coach' },
  { command: 'start',    description: '🔄 Restart onboarding' },
];

async function call(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`${method} failed: ${data.description}`);
  return data;
}

(async () => {
  await call('setMyCommands', { commands: COMMANDS });
  console.log('✓ Registered', COMMANDS.length, 'commands');

  await call('setChatMenuButton', { menu_button: { type: 'commands' } });
  console.log('✓ Set menu button to commands');

  await call('setMyDescription', {
    description: 'A senior AI coach for working professionals. Five focused minutes a day to apply frontier AI to your real work — paired with the web chat at dg-ai-coach-eta.vercel.app.',
  });
  console.log('✓ Set bot description');

  await call('setMyShortDescription', {
    short_description: 'Your senior AI coach. 5 minutes a day to apply AI at work.',
  });
  console.log('✓ Set short description');

  console.log('\nDone — open the bot in Telegram, the menu icon should now show all commands.');
})().catch(err => { console.error(err); process.exit(1); });
