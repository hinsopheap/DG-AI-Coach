// lib/onboarding-web.js — same conversational onboarding as Telegram, but
// returns structured replies + suggestions for the web UI to render as
// buttons. Mirrors lib/onboarding.js behaviour so we keep one mental model.

import { updateUser, getDefaultPathForRole, appendMessage, logActivity, getUserById } from './firebase.js';

const LANG_BTNS = ['English', 'ខ្មែរ'];
const ROLE_BTNS = ['CEO / Founder', 'GM / Director', 'Senior Manager', 'Team Leader', 'Professional'];
const GOAL_BTNS = ['Use AI daily at work', 'Draft faster with AI', 'Coach my team with AI', 'Explore AI fundamentals'];

function mapRole(label) {
  const s = (label || '').toLowerCase();
  if (s.includes('ceo') || s.includes('founder')) return 'ceo';
  if (s.includes('gm') || s.includes('director')) return 'gm';
  if (s.includes('senior')) return 'senior_manager';
  if (s.includes('leader')) return 'team_leader';
  return 'professional';
}

function mapLang(label) {
  if (!label) return 'en';
  return /khmer|ខ្មែរ/i.test(label) ? 'km' : 'en';
}

// status is the source of truth. step is just internal flow state and can
// briefly be 'assigning' between writes; do not gate on it.
export function isOnboarding(user) {
  if (!user) return true;
  return user.status !== 'active' && user.status !== 'waitlist';
}

export async function startOnboarding(user) {
  await updateUser(user.id, { onboarding_step: 'language' });
  return {
    replies: ['👋 Welcome to DG AI Coach — 5 minutes a day to apply AI at work.\n\nFirst, pick your language.'],
    suggestions: LANG_BTNS,
    user: { ...user, onboarding_step: 'language' },
  };
}

export async function handleOnboardingMessage(user, text) {
  const step = user.onboarding_step || 'language';
  const t = (text || '').trim();

  // Persist user message
  await appendMessage(user.id, { role: 'user', text: t, surface: 'web' });

  let replies = [];
  let suggestions = [];

  switch (step) {
    case 'language': {
      const lang = mapLang(t);
      await updateUser(user.id, { preferred_language: lang, onboarding_step: 'name' });
      replies = [lang === 'km' ? 'ល្អហើយ។ តើអ្នកមានឈ្មោះពេញជាអ្វី?' : 'Great. What is your full name?'];
      break;
    }
    case 'name': {
      const name = t.slice(0, 80);
      if (!name) { replies = ['Please send your name.']; break; }
      await updateUser(user.id, { full_name: name, onboarding_step: 'role' });
      replies = [`Nice to meet you, ${name}. Which best describes your role?`];
      suggestions = ROLE_BTNS;
      break;
    }
    case 'role': {
      const role = mapRole(t);
      await updateUser(user.id, { role, onboarding_step: 'goal' });
      replies = ['Got it. What is your main learning goal right now?'];
      suggestions = GOAL_BTNS;
      break;
    }
    case 'goal': {
      const goal = t.slice(0, 200);
      await updateUser(user.id, { goal });

      try {
        const fresh = await getUserById(user.id);
        const path = await getDefaultPathForRole(fresh.role);
        if (path) {
          await updateUser(fresh.id, {
            learning_path_id: path.id,
            status:           'active',
            onboarding_step:  'done',
          });
          await logActivity(fresh.id, 'onboarding_complete', { path_id: path.id, surface: 'web' });
          try {
            const { checkOnboardingAchievement } = await import('./gamification.js');
            const latest = await getUserById(fresh.id);
            if (latest) await checkOnboardingAchievement(latest);
          } catch {}
          replies = [
            `✅ You are enrolled in **${path.title}**.`,
            'Want to start with today\'s task right now, or chat first about what you\'re working on?',
          ];
          suggestions = ["Today's task", 'Chat first'];
        } else {
          await updateUser(fresh.id, { status: 'waitlist', onboarding_step: 'done' });
          replies = ['Thanks — no learning path is live yet for your role. I will notify you when one opens.'];
        }
      } catch (err) {
        console.error('[onboarding-web] path assignment failed:', err);
        await updateUser(user.id, { status: 'active', onboarding_step: 'done' });
        replies = ['Thanks. I had a hiccup assigning your path — an admin will sort it out. In the meantime, what are you working on right now?'];
      }
      break;
    }
    default:
      replies = ['You are already set up. What would you like to work on?'];
      suggestions = ["Today's task", 'My progress', 'I have a question'];
  }

  // Persist assistant replies
  for (const r of replies) {
    await appendMessage(user.id, { role: 'assistant', text: r, surface: 'web' });
  }

  const updated = await getUserById(user.id);
  return { replies, suggestions, user: updated };
}
