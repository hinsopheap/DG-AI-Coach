// lib/ai-errors.js — translate raw Anthropic SDK errors into messages a
// learner can understand without exposing infrastructure details. Returns a
// consistent shape so both web and Telegram surfaces can render the same
// fallback gracefully.

export function friendlyAIError(err) {
  const raw = String(err?.message || err || '');

  // Common operational failures the user can do nothing about
  if (/credit balance is too low|billing/i.test(raw)) {
    return {
      message:   'The coach is offline for a moment — the team is topping up the AI credits. Try again in a few minutes, or check your dashboard in the meantime.',
      retriable: true,
      kind:      'billing',
    };
  }
  if (/rate.?limit|429/i.test(raw)) {
    return {
      message:   "I'm getting a lot of requests right now. Give me a few seconds and try again.",
      retriable: true,
      kind:      'rate_limit',
    };
  }
  if (/timeout|deadline.?exceeded|ETIMEDOUT/i.test(raw)) {
    return {
      message:   "That one took too long on my side. Send it again and I'll be quicker.",
      retriable: true,
      kind:      'timeout',
    };
  }
  if (/authentication|unauthorized|invalid.*api.*key/i.test(raw)) {
    return {
      message:   "The coach is offline — there's a configuration issue an admin needs to fix. Try again in a bit.",
      retriable: true,
      kind:      'auth',
    };
  }
  if (/safety|content.*policy/i.test(raw)) {
    return {
      message:   "I can't respond to that one. Try rephrasing what you'd like help with.",
      retriable: false,
      kind:      'policy',
    };
  }

  // Generic fallback — never leak the raw stack
  return {
    message:   "Something tripped on my side. Try again, and if it keeps happening, ping the admin.",
    retriable: true,
    kind:      'unknown',
  };
}
