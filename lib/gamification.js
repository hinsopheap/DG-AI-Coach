// lib/gamification.js — XP, levels, achievements, and coach-awarded prizes.
//
// Stored on the user document under these fields:
//   xp: number
//   level: number (derived but cached)
//   achievements: string[] (codes from ACHIEVEMENTS)
//   awards: [{ code, title, reason, given_at, source: 'auto'|'coach' }]

import { db, FieldValue, updateUser, logActivity } from './firebase.js';

// ── Level curve: triangular growth. level = floor(sqrt(xp/50)) + 1 ────────────
// L1: 0 xp, L2: 50, L3: 200, L4: 450, L5: 800, L6: 1250, L7: 1800, L8: 2450

export const LEVEL_NAMES = [
  '',
  'Novice',
  'Apprentice',
  'Practitioner',
  'Skilled',
  'Adept',
  'Expert',
  'Master',
  'Frontier',
];

export function levelFromXP(xp) {
  return Math.floor(Math.sqrt(Math.max(0, xp || 0) / 50)) + 1;
}

export function xpForLevel(level) {
  return (level - 1) * (level - 1) * 50;
}

export function levelName(level) {
  return LEVEL_NAMES[level] || `Level ${level}`;
}

export function levelInfo(xp) {
  const level = levelFromXP(xp);
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  const progress = ceil === floor ? 1 : (xp - floor) / (ceil - floor);
  return {
    xp:         xp || 0,
    level,
    levelName:  levelName(level),
    floor,
    ceil,
    toNext:     Math.max(0, ceil - (xp || 0)),
    progress:   Math.min(1, Math.max(0, progress)),
  };
}

// ── Preset achievements ──────────────────────────────────────────────────────

export const ACHIEVEMENTS = {
  first_step: {
    icon: '🎯', title: 'First Step',
    desc: 'Completed onboarding and got your learning path',
    xp:   50,
  },
  first_submission: {
    icon: '🚀', title: 'First Submission',
    desc: 'Submitted your first task answer',
    xp:   25,
  },
  streak_3: {
    icon: '🔥', title: '3-Day Streak',
    desc: 'Three consecutive days of learning',
    xp:   75,
  },
  streak_7: {
    icon: '🔥', title: '7-Day Streak',
    desc: 'A full week of daily practice',
    xp:   200,
  },
  streak_14: {
    icon: '🔥', title: '14-Day Streak',
    desc: 'Two weeks strong',
    xp:   400,
  },
  high_score: {
    icon: '🏆', title: 'High Score',
    desc: 'Scored 9+ on a task',
    xp:   100,
  },
  perfect_score: {
    icon: '🎖️', title: 'Perfect Score',
    desc: 'Scored 10/10 on a task',
    xp:   250,
  },
  paired_surfaces: {
    icon: '🔗', title: 'Omnichannel',
    desc: 'Linked Telegram and Web',
    xp:   50,
  },
  path_complete: {
    icon: '🎓', title: 'Path Complete',
    desc: 'Finished a learning path end-to-end',
    xp:   500,
  },
  deep_thinker: {
    icon: '💡', title: 'Deep Thinker',
    desc: 'Asked 10 coaching questions',
    xp:   50,
  },
  marathon: {
    icon: '🏅', title: 'Marathon',
    desc: 'Reached 1000 XP — serious practice',
    xp:   100,
  },
};

export function achievementMeta(code) {
  return ACHIEVEMENTS[code] || null;
}

// ── Unified XP awarding ──────────────────────────────────────────────────────

// Award XP to a user. If the award unlocks new achievements, also grant their
// XP and append to achievements + awards. Returns a summary of what happened.
export async function awardXP(user, amount, reason = '', source = 'auto') {
  const gain = Math.max(0, Math.round(amount || 0));
  if (gain === 0) return { xp_gained: 0, new_level: levelFromXP(user.xp), unlocked: [] };

  const beforeLevel = levelFromXP(user.xp || 0);
  const newXP = (user.xp || 0) + gain;
  const afterLevel = levelFromXP(newXP);

  await db().collection('coach_users').doc(user.id).update({
    xp:         FieldValue.increment(gain),
    level:      afterLevel,
    updated_at: FieldValue.serverTimestamp(),
  });
  user.xp = newXP;
  user.level = afterLevel;

  if (reason) await logActivity(user.id, 'xp_awarded', { amount: gain, reason, source });

  return {
    xp_gained:  gain,
    new_total:  newXP,
    prev_level: beforeLevel,
    new_level:  afterLevel,
    leveled_up: afterLevel > beforeLevel,
  };
}

// Grant an achievement by code. No-op if already unlocked. Awards the
// achievement's preset XP on first unlock.
export async function grantAchievement(user, code, { reason = '' } = {}) {
  const meta = ACHIEVEMENTS[code];
  if (!meta) return null;
  const current = Array.isArray(user.achievements) ? user.achievements : [];
  if (current.includes(code)) return null;

  const award = {
    code,
    title:     meta.title,
    icon:      meta.icon,
    desc:      meta.desc,
    reason:    reason || meta.desc,
    xp:        meta.xp,
    source:    'auto',
    given_at:  new Date().toISOString(),
  };

  await db().collection('coach_users').doc(user.id).update({
    achievements: FieldValue.arrayUnion(code),
    awards:       FieldValue.arrayUnion(award),
    updated_at:   FieldValue.serverTimestamp(),
  });
  user.achievements = [...current, code];
  user.awards = [...(user.awards || []), award];

  await awardXP(user, meta.xp, `achievement:${code}`, 'auto');
  await logActivity(user.id, 'achievement_unlocked', { code });

  return award;
}

// Grant a custom award from the coach (the "prize" tool).
export async function grantCoachAward(user, { title, reason, xp = 50 }) {
  const safeTitle = String(title || 'Coach\'s Pick').slice(0, 60);
  const safeReason = String(reason || '').slice(0, 200);
  const award = {
    code:      'coach_pick:' + Date.now(),
    title:     safeTitle,
    icon:      '🎖️',
    desc:      safeReason,
    reason:    safeReason,
    xp,
    source:    'coach',
    given_at:  new Date().toISOString(),
  };

  await db().collection('coach_users').doc(user.id).update({
    awards:     FieldValue.arrayUnion(award),
    updated_at: FieldValue.serverTimestamp(),
  });
  user.awards = [...(user.awards || []), award];

  await awardXP(user, xp, `coach_award:${safeTitle}`, 'coach');
  await logActivity(user.id, 'coach_award_given', { title: safeTitle, xp });

  return award;
}

// Check and grant any achievements newly earned from a state change.
export async function checkStreakAchievements(user) {
  const unlocked = [];
  const streak = user.streak_count || 0;
  if (streak >= 14) {
    const a = await grantAchievement(user, 'streak_14');
    if (a) unlocked.push(a);
  }
  if (streak >= 7) {
    const a = await grantAchievement(user, 'streak_7');
    if (a) unlocked.push(a);
  }
  if (streak >= 3) {
    const a = await grantAchievement(user, 'streak_3');
    if (a) unlocked.push(a);
  }
  return unlocked;
}

export async function checkScoreAchievements(user, score) {
  const unlocked = [];
  if (score >= 10) {
    const a = await grantAchievement(user, 'perfect_score');
    if (a) unlocked.push(a);
  } else if (score >= 9) {
    const a = await grantAchievement(user, 'high_score');
    if (a) unlocked.push(a);
  }
  return unlocked;
}

export async function checkFirstSubmission(user) {
  const existing = (user.achievements || []).includes('first_submission');
  if (existing) return null;
  return grantAchievement(user, 'first_submission');
}

export async function checkMarathon(user) {
  if ((user.xp || 0) >= 1000) {
    return grantAchievement(user, 'marathon');
  }
  return null;
}

export async function checkOnboardingAchievement(user) {
  return grantAchievement(user, 'first_step');
}

export async function checkPairedAchievement(user) {
  return grantAchievement(user, 'paired_surfaces');
}

// Main post-submission hook: awards submission XP + checks all relevant
// achievements. Returns everything that happened for display.
export async function processSubmissionGains(user, { score, streak }) {
  // Assume user has been updated with the new streak already.
  user.streak_count = streak;

  const baseXP = Math.round((score || 0) * 10);
  const streakBonus = streak > 1 ? Math.min(streak * 5, 50) : 0;
  const gainTotal = baseXP + streakBonus;
  const xpResult = await awardXP(user, gainTotal, 'submission', 'auto');

  const unlocked = [];
  const first = await checkFirstSubmission(user);
  if (first) unlocked.push(first);
  unlocked.push(...(await checkScoreAchievements(user, score)));
  unlocked.push(...(await checkStreakAchievements(user)));
  const marathon = await checkMarathon(user);
  if (marathon) unlocked.push(marathon);

  return {
    xp_gained:   xpResult.xp_gained,
    leveled_up:  xpResult.leveled_up,
    new_level:   xpResult.new_level,
    unlocked,
    base_xp:     baseXP,
    streak_bonus:streakBonus,
  };
}

// ── Public user dashboard snapshot ───────────────────────────────────────────

export function dashboardSnapshot(user) {
  const info = levelInfo(user.xp || 0);
  const achievements = (user.achievements || []).map(code => ({
    code,
    ...(ACHIEVEMENTS[code] || {}),
  }));
  const awards = (user.awards || []).slice().sort((a, b) => {
    const ta = new Date(a.given_at || 0).getTime();
    const tb = new Date(b.given_at || 0).getTime();
    return tb - ta;
  });

  return {
    xp:            info.xp,
    level:         info.level,
    level_name:    info.levelName,
    level_floor:   info.floor,
    level_ceil:    info.ceil,
    level_to_next: info.toNext,
    progress:      info.progress,
    streak_count:  user.streak_count || 0,
    achievements,
    awards,
    unlocked_count: achievements.length,
    total_achievements: Object.keys(ACHIEVEMENTS).length,
  };
}
