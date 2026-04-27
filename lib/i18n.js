// lib/i18n.js — UI chrome translations for English and Khmer.
//
// Anything that is dynamic (coach replies, task content, dashboard data) is
// translated by Claude on the fly via the system prompt. This file only
// covers the static surfaces: suggestion chips, button labels, placeholders,
// canned bot messages, end-session card.

const T = {
  // Suggestion chips (reused on web + Telegram)
  'sug.todays_task':         { en: "Today's task",           km: 'កិច្ចការថ្ងៃនេះ' },
  'sug.my_progress':         { en: 'My progress',            km: 'វឌ្ឍនភាពរបស់ខ្ញុំ' },
  'sug.i_have_a_question':   { en: 'I have a question',      km: 'ខ្ញុំមានសំណួរ' },
  'sug.submit_my_answer':    { en: 'Submit my answer',       km: 'ដាក់ស្នើចម្លើយរបស់ខ្ញុំ' },
  'sug.help_with_this_task': { en: 'Help with this task',    km: 'ជួយលើកិច្ចការនេះ' },
  'sug.try_again':           { en: 'Try again',              km: 'សាកល្បងម្ដងទៀត' },

  // Composer
  'composer.placeholder':    { en: 'Message your coach…',    km: 'ផ្ញើសារទៅគ្រូបង្វឹក…' },
  'composer.listening':      { en: 'Listening…',             km: 'កំពុងស្ដាប់…' },
  'composer.send':           { en: 'Send',                   km: 'ផ្ញើ' },

  // Header / status
  'header.welcome':          { en: 'Welcome',                km: 'សូមស្វាគមន៍' },
  'header.connecting':       { en: 'Connecting…',            km: 'កំពុងភ្ជាប់…' },
  'header.linked':           { en: 'linked',                 km: 'បានភ្ជាប់' },
  'header.streak_days':      { en: 'd',                      km: 'ថ្ងៃ' },

  // End session
  'end.until_next':          { en: 'Until next time',        km: 'រហូតដល់លើកក្រោយ' },
  'end.coach_note':          { en: 'A note from your coach', km: 'សារពីគ្រូបង្វឹករបស់អ្នក' },
  'end.what_did_well':       { en: 'What you did well today.', km: 'អ្វីដែលអ្នកធ្វើបានល្អនៅថ្ងៃនេះ។' },
  'end.before_next':         { en: 'Before next time.',      km: 'មុនលើកក្រោយ។' },
  'end.where_you_stand':     { en: 'Where you stand',        km: 'ឋានៈរបស់អ្នក' },
  'end.keep_coaching':       { en: '← Keep coaching',        km: '← បន្តការបង្វឹក' },
  'end.end_session':         { en: 'End session',            km: 'បញ្ចប់វគ្គបង្វឹក' },
  'end.confirm_signout':     { en: 'Yes, sign out',          km: 'យល់ព្រម ចេញ' },
  'end.stay':                { en: 'Stay',                   km: 'ស្នាក់នៅ' },

  // Telegram canned
  'tg.voice_unavailable':    {
    en: '🎙️ I hear you — voice transcription is not enabled yet. Please type your reply, or use voice-to-text on your keyboard.',
    km: '🎙️ ខ្ញុំស្ដាប់អ្នក — ការបកប្រែសំឡេងមិនទាន់បានបើកទេ។ សូមវាយចម្លើយ ឬប្រើ voice-to-text លើក្ដារចុចរបស់អ្នក។',
  },
  'tg.cant_load_image':      { en: 'I could not load that image. Please try again.', km: 'ខ្ញុំមិនអាចផ្ទុករូបនោះបានទេ។ សូមព្យាយាមម្ដងទៀត។' },
  'tg.thinking':             { en: '_💭 Thinking…_',          km: '_💭 កំពុងគិត…_' },
  'tg.language_set_en':      { en: '✅ Language set to English. I\'ll reply in English from now on.',  km: '✅ ភាសាបានកំណត់ជា English។ ខ្ញុំនឹងឆ្លើយជាភាសាអង់គ្លេសពីពេលនេះតទៅ។' },
  'tg.language_set_km':      { en: '✅ Language set to Khmer. ខ្ញុំនឹងឆ្លើយជាភាសាខ្មែរពីពេលនេះតទៅ។',  km: '✅ ភាសាបានកំណត់ជាខ្មែរ។ ខ្ញុំនឹងឆ្លើយជាភាសាខ្មែរពីពេលនេះតទៅ។' },
  'tg.language_pick':        { en: '🌐 Pick your language.', km: '🌐 ជ្រើសរើសភាសា។' },
};

export function t(lang, key, fallback) {
  const entry = T[key];
  if (!entry) return fallback ?? key;
  return entry[lang === 'km' ? 'km' : 'en'] || entry.en || fallback || key;
}

// Helper for Telegram quick suggestions — returns localized chips for both
// "task in progress" and "no task" states.
export function localizedSuggestions(user) {
  const lang = user?.preferred_language === 'km' ? 'km' : 'en';
  const out = [];
  if (user?.last_task_id) {
    out.push(t(lang, 'sug.submit_my_answer'));
    out.push(t(lang, 'sug.help_with_this_task'));
  } else {
    out.push(t(lang, 'sug.todays_task'));
  }
  out.push(t(lang, 'sug.my_progress'));
  if (out.length < 3) out.push(t(lang, 'sug.i_have_a_question'));
  return out.slice(0, 3);
}
