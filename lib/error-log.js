// lib/error-log.js — lightweight Sentry alternative.
//
// Writes errors to coach_errors collection in Firestore. Visible at
// /admin/errors. Cheap, simple, no external dependency. Upgrade to Sentry
// when error volume justifies it.

import { db, FieldValue } from './firebase.js';

export async function logError(scope, err, context = {}) {
  try {
    await db().collection('coach_errors').add({
      scope:      String(scope || 'unknown'),
      message:    err?.message || String(err || 'unknown'),
      stack:      typeof err?.stack === 'string' ? err.stack.slice(0, 4000) : null,
      context:    sanitize(context),
      created_at: FieldValue.serverTimestamp(),
    });
  } catch {
    // Never throw from the logger — that would mask the original error.
  }
}

function sanitize(ctx) {
  const out = {};
  for (const [k, v] of Object.entries(ctx || {})) {
    // Strip secrets and very-long values
    if (/(token|secret|password|key|cookie|authorization)/i.test(k)) continue;
    if (typeof v === 'string') out[k] = v.slice(0, 500);
    else if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    else if (v == null) out[k] = null;
    else out[k] = '[object]';
  }
  return out;
}

// Wrapper for API handlers. Catches async errors, logs them, and returns a
// 500 with a generic message so we never leak stack traces to users.
export function withErrorLogging(scope, handler) {
  return async (req, res) => {
    try {
      return await handler(req, res);
    } catch (err) {
      await logError(scope, err, {
        url:    req.url,
        method: req.method,
      });
      console.error(`[${scope}]`, err);
      if (!res.headersSent) {
        res.status(500).json({ ok: false, error: 'Internal server error' });
      }
    }
  };
}

export async function listRecentErrors({ limit = 100 } = {}) {
  const snap = await db()
    .collection('coach_errors')
    .orderBy('created_at', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
