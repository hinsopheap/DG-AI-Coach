// pages/api/health.js — uptime probe. Verifies Firestore reachability with a
// cheap query so monitoring tools catch real outages, not just bad responses.

import { db } from '../../lib/firebase.js';

const STARTED_AT = Date.now();

export default async function handler(req, res) {
  const checks = { app: 'ok' };
  let firestoreOk = false;

  try {
    // Touch any small collection. We don't care about the content.
    await db().collection('coach_paths').limit(1).get();
    firestoreOk = true;
  } catch (err) {
    checks.firestore_error = err.message;
  }
  checks.firestore = firestoreOk ? 'ok' : 'fail';

  const ok = firestoreOk;
  return res.status(ok ? 200 : 503).json({
    ok,
    uptime_ms: Date.now() - STARTED_AT,
    checks,
    timestamp: new Date().toISOString(),
  });
}
