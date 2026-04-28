// lib/topics.js — starter conversation topics shown to learners.
//
// Each topic is a tap-to-start prompt that opens a coaching thread on a
// concrete subject. Topics map to the 6 domain tracks so we don't grow a
// separate information architecture. Each has EN + KM labels and prompts.

export const TOPICS = [
  // PEOPLE
  {
    id:        'team_adoption',
    track:     'people',
    icon:      '🧭',
    label_en:  'Get my team using AI',
    label_km:  'ឲ្យក្រុមរបស់ខ្ញុំប្រើ AI',
    prompt_en: "I want my team to actually use AI in their daily work — not just talk about it. Help me build a 30-day plan that fits my team.",
    prompt_km: "ខ្ញុំចង់ឲ្យក្រុមការងាររបស់ខ្ញុំប្រើ AI ក្នុងការងារប្រចាំថ្ងៃ — មិនមែនគ្រាន់តែនិយាយអំពីវាទេ។ សូមជួយខ្ញុំរៀបចំផែនការ៣០ថ្ងៃដែលសមនឹងក្រុមរបស់ខ្ញុំ។",
  },
  {
    id:        'delegate_to_ai',
    track:     'people',
    icon:      '🪄',
    label_en:  'Delegate one task to AI this week',
    label_km:  'ផ្ទេរកិច្ចការមួយឲ្យ AI សប្ដាហ៍នេះ',
    prompt_en: "Pick one repeating task on my plate that I should hand to AI this week. Walk me through how.",
    prompt_km: "ជ្រើសរើសកិច្ចការមួយដែលខ្ញុំធ្វើម្ដងហើយម្ដងទៀតដែលគួរប្រើ AI សប្ដាហ៍នេះ។ ណែនាំខ្ញុំពីរបៀប។",
  },

  // COMMUNICATION
  {
    id:        'write_better',
    track:     'communication',
    icon:      '✍️',
    label_en:  'Write something better with AI',
    label_km:  'សរសេរអ្វីមួយបានល្អជាមួយ AI',
    prompt_en: "I have a message I need to write — staff update, board memo, or customer reply. Help me write it sharper than I would alone.",
    prompt_km: "ខ្ញុំមានសារដែលត្រូវសរសេរ — ការអាប់ដេតបុគ្គលិក memo ក្ដារបញ្ជាក់ ឬចម្លើយអតិថិជន។ សូមជួយខ្ញុំសរសេរវាឲ្យច្បាស់ជាងធ្វើម្នាក់ឯង។",
  },
  {
    id:        'translate_workflow',
    track:     'communication',
    icon:      '🇰🇭',
    label_en:  'Translate English ↔ Khmer faster',
    label_km:  'បកប្រែ អង់គ្លេស ↔ ខ្មែរ លឿនជាងមុន',
    prompt_en: "I translate between English and Khmer regularly for my team. Help me build a reusable AI workflow that gets the register right, not just the words.",
    prompt_km: "ខ្ញុំបកប្រែអង់គ្លេស-ខ្មែរ សម្រាប់ក្រុមរបស់ខ្ញុំជាប្រចាំ។ សូមជួយខ្ញុំបង្កើតលំហូរការងារ AI ដែលអាចប្រើបានឡើងវិញ ដែលត្រូវនឹងសម្ដី មិនមែនគ្រាន់តែពាក្យទេ។",
  },

  // DECISIONS
  {
    id:        'pressure_test',
    track:     'decisions',
    icon:      '⚖️',
    label_en:  'Pressure-test a decision I\'m about to make',
    label_km:  'សាកល្បងសម្ពាធលើការសម្រេចចិត្តដែលខ្ញុំនឹងធ្វើ',
    prompt_en: "I have a decision I'm 80% sure about. I want you to attack it from the angle I'm probably underweighting.",
    prompt_km: "ខ្ញុំមានការសម្រេចចិត្តមួយដែលខ្ញុំ ៨០% ប្រាកដ។ ខ្ញុំចង់ឲ្យអ្នកវាយប្រហារវាពីមុំដែលខ្ញុំទំនងជាមើលរំលង។",
  },
  {
    id:        'hiring_decision',
    track:     'decisions',
    icon:      '🤝',
    label_en:  'Sharpen a hiring decision',
    label_km:  'ធ្វើឲ្យការសម្រេចចិត្តជ្រើសរើសបុគ្គលិកឲ្យច្បាស់',
    prompt_en: "I'm considering a candidate for a role on my team. Help me see the 3 risks I'm probably downplaying.",
    prompt_km: "ខ្ញុំកំពុងពិចារណាបេក្ខជនមួយសម្រាប់តំណែងក្នុងក្រុមខ្ញុំ។ សូមជួយឲ្យខ្ញុំមើលឃើញហានិភ័យ ៣ ដែលខ្ញុំទំនងជាមិនយកចិត្តទុកដាក់។",
  },

  // OPERATIONS
  {
    id:        'spot_opportunities',
    track:     'operations',
    icon:      '🎯',
    label_en:  'Spot 3 AI opportunities in my business',
    label_km:  'រកឱកាស AI បី នៅក្នុងអាជីវកម្មរបស់ខ្ញុំ',
    prompt_en: "Help me find 3 places in my business where AI would save real time this month — not theoretical, real.",
    prompt_km: "សូមជួយខ្ញុំរកកន្លែងបី ក្នុងអាជីវកម្មរបស់ខ្ញុំ ដែល AI អាចសន្សំសំចៃពេលវេលាពិតប្រាកដនៅខែនេះ — មិនមែនតាមទ្រឹស្ដីទេ ពិតប្រាកដ។",
  },
  {
    id:        'cut_weekly_task',
    track:     'operations',
    icon:      '⏱️',
    label_en:  'Cut a weekly task in half',
    label_km:  'កាត់បន្ថយកិច្ចការប្រចាំសប្ដាហ៍ពាក់កណ្ដាល',
    prompt_en: "Pick one task I do every week that takes 1+ hour. Help me redesign it with AI so it takes 30 minutes.",
    prompt_km: "ជ្រើសរើសកិច្ចការមួយដែលខ្ញុំធ្វើជារៀងរាល់សប្ដាហ៍ដែលត្រូវការម៉ោងជាង។ សូមជួយខ្ញុំរៀបចំឡើងវិញជាមួយ AI ដើម្បីឲ្យត្រូវការ ៣០ នាទី។",
  },

  // STRATEGY
  {
    id:        'sharpen_strategy',
    track:     'strategy',
    icon:      '🧩',
    label_en:  'Sharpen our quarterly strategy',
    label_km:  'ធ្វើឲ្យយុទ្ធសាស្ត្រប្រចាំត្រីមាសរបស់យើងច្បាស់',
    prompt_en: "Help me write our strategy in one sentence — who we serve, what we do for them, how we win — and pressure-test it.",
    prompt_km: "សូមជួយខ្ញុំសរសេរយុទ្ធសាស្ត្ររបស់យើងជាប្រយោគមួយ — តើយើងបម្រើនរណា ធ្វើអ្វីជូនពួកគេ យើងយកឈ្នះយ៉ាងណា — ហើយសាកល្បងវា។",
  },
  {
    id:        'kill_a_project',
    track:     'strategy',
    icon:      '✂️',
    label_en:  'Kill a project that isn\'t working',
    label_km:  'បញ្ចប់គម្រោងដែលមិនដំណើរការ',
    prompt_en: "I have a project that's eating hours every month and not compounding. Help me write the kill plan.",
    prompt_km: "ខ្ញុំមានគម្រោងមួយដែលកំពុងប្រើពេលច្រើនម៉ោងរៀងរាល់ខែ ហើយមិនកើនឡើង។ សូមជួយខ្ញុំសរសេរផែនការបញ្ចប់។",
  },

  // RESPONSIBLE AI
  {
    id:        'data_safety',
    track:     'responsible',
    icon:      '🛡',
    label_en:  'What data should I never put in AI?',
    label_km:  'ទិន្នន័យអ្វីដែលខ្ញុំមិនគួរដាក់ក្នុង AI?',
    prompt_en: "I want to use AI more aggressively at work but I'm nervous about data. Tell me what's safe and what isn't, in my Cambodia context.",
    prompt_km: "ខ្ញុំចង់ប្រើ AI ច្រើនជាងមុនក្នុងការងារ តែខ្ញុំបារម្ភអំពីទិន្នន័យ។ សូមប្រាប់ខ្ញុំថាអ្វីខ្លះដែលមានសុវត្ថិភាព និងអ្វីខ្លះដែលមិនមាន ក្នុងបរិបទកម្ពុជា។",
  },
  {
    id:        'team_ai_rules',
    track:     'responsible',
    icon:      '📜',
    label_en:  'Set AI ground rules for my team',
    label_km:  'កំណត់ច្បាប់មូលដ្ឋាន AI សម្រាប់ក្រុមរបស់ខ្ញុំ',
    prompt_en: "I want my team to use AI confidently but responsibly. Help me draft 5 ground rules they'd actually follow.",
    prompt_km: "ខ្ញុំចង់ឲ្យក្រុមរបស់ខ្ញុំប្រើ AI ដោយទំនុកចិត្ត និងទទួលខុសត្រូវ។ សូមជួយខ្ញុំព្រាងច្បាប់មូលដ្ឋាន ៥ ដែលពួកគេនឹងគោរពពិតប្រាកដ។",
  },
];

export function topicLabel(topic, lang) {
  return lang === 'km' ? topic.label_km : topic.label_en;
}

export function topicPrompt(topic, lang) {
  return lang === 'km' ? topic.prompt_km : topic.prompt_en;
}

// Public payload for the web/Telegram surfaces.
export function topicsForLang(lang) {
  return TOPICS.map(t => ({
    id:    t.id,
    track: t.track,
    icon:  t.icon,
    label: topicLabel(t, lang),
    prompt: topicPrompt(t, lang),
  }));
}
