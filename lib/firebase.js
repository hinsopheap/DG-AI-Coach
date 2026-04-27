// lib/firebase.js — Firestore admin singleton for DG AI Coach.
// All coach collections are prefixed `coach_` so they live alongside the
// other 16 collections in the single shared Firebase project.

import admin from 'firebase-admin';

export function db() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
  return admin.firestore();
}

export const FieldValue = admin.firestore.FieldValue;
export const Timestamp = admin.firestore.Timestamp;

// ── User profile ───────────────────────────────────────────────────────────────

export async function getUserByTelegramId(telegramId) {
  const snap = await db()
    .collection('coach_users')
    .where('telegram_id', '==', String(telegramId))
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function createUser(data) {
  const ref = await db().collection('coach_users').add({
    telegram_id:        String(data.telegram_id),
    full_name:          data.full_name || '',
    preferred_language: data.preferred_language || 'en',
    role:               data.role || null,
    goal:               data.goal || null,
    organization_id:    data.organization_id || null,
    learning_path_id:   data.learning_path_id || null,
    status:             'onboarding',
    streak_count:       0,
    last_task_date:     null,
    onboarding_step:    'start',
    created_at:         FieldValue.serverTimestamp(),
    updated_at:         FieldValue.serverTimestamp(),
  });
  return { id: ref.id };
}

export async function updateUser(userId, patch) {
  await db().collection('coach_users').doc(userId).update({
    ...patch,
    updated_at: FieldValue.serverTimestamp(),
  });
}

export async function listUsers({ limit = 200 } = {}) {
  const snap = await db()
    .collection('coach_users')
    .orderBy('created_at', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Learning paths ─────────────────────────────────────────────────────────────

export async function listPaths({ onlyActive = false } = {}) {
  let q = db().collection('coach_paths');
  if (onlyActive) q = q.where('status', '==', 'active');
  const snap = await q.get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getPath(pathId) {
  const doc = await db().collection('coach_paths').doc(pathId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

export async function getDefaultPathForRole(role) {
  // Two equality filters would require a composite index; fetch active paths
  // and pick in JS. Path counts are small (3 today, single digits long-term).
  const snap = await db()
    .collection('coach_paths')
    .where('status', '==', 'active')
    .get();
  if (snap.empty) return null;
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const match = all.find(p => p.target_role === role);
  return match || all[0];
}

// ── Tasks ──────────────────────────────────────────────────────────────────────

export async function listTasksForPath(pathId) {
  const snap = await db()
    .collection('coach_tasks')
    .where('learning_path_id', '==', pathId)
    .get();
  const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  tasks.sort((a, b) => (a.sequence_order || 0) - (b.sequence_order || 0));
  return tasks;
}

export async function getTask(taskId) {
  const doc = await db().collection('coach_tasks').doc(taskId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

export async function getNextTaskForUser(user) {
  if (!user.learning_path_id) return null;
  const tasks = await listTasksForPath(user.learning_path_id);
  if (!tasks.length) return null;

  // Find completed submissions for this user
  const subSnap = await db()
    .collection('coach_submissions')
    .where('user_id', '==', user.id)
    .get();
  const done = new Set(subSnap.docs.map(d => d.data().task_id));

  const next = tasks.find(t => !done.has(t.id) && t.status !== 'inactive');
  return next || null;
}

// ── Rubrics ────────────────────────────────────────────────────────────────────

export async function getRubric(rubricId) {
  if (!rubricId) return null;
  const doc = await db().collection('coach_rubrics').doc(rubricId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

// ── Submissions ────────────────────────────────────────────────────────────────

export async function createSubmission(data) {
  const ref = await db().collection('coach_submissions').add({
    user_id:         data.user_id,
    task_id:         data.task_id,
    submission_type: data.submission_type || 'text',
    submission_text: data.submission_text || '',
    score_json:      data.score_json || null,
    total_score:     data.total_score ?? null,
    feedback_text:   data.feedback_text || '',
    created_at:      FieldValue.serverTimestamp(),
  });
  return { id: ref.id };
}

export async function listSubmissionsForUser(userId, { limit = 100 } = {}) {
  // No orderBy — that would require a composite index. Per-user submission
  // counts are small (target: 5/week), so sorting in memory is cheaper than
  // managing an index per coach_* collection.
  const snap = await db()
    .collection('coach_submissions')
    .where('user_id', '==', userId)
    .get();
  const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  rows.sort((a, b) => {
    const ta = a.created_at?.toMillis?.() || 0;
    const tb = b.created_at?.toMillis?.() || 0;
    return tb - ta;
  });
  return rows.slice(0, limit);
}

// ── Brain memory (per-user distilled state) ──────────────────────────────────

export async function getMemory(userId) {
  const doc = await db().collection('coach_memory').doc(userId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

export async function setMemory(userId, patch) {
  await db().collection('coach_memory').doc(userId).set(
    { ...patch, updated_at: FieldValue.serverTimestamp() },
    { merge: true },
  );
}

export async function deleteMemory(userId) {
  await db().collection('coach_memory').doc(userId).delete();
}

// ── User avatar (web upload OR fetched Telegram profile photo) ───────────────

export async function setUserAvatar(userId, avatarUrl) {
  await db().collection('coach_users').doc(userId).update({
    avatar_url: avatarUrl,
    updated_at: FieldValue.serverTimestamp(),
  });
}

// ── Messages (unified web + Telegram conversation) ───────────────────────────

export async function appendMessage(userId, { role, text, surface, tool_calls = null }) {
  await db().collection('coach_messages').add({
    user_id:    userId,
    role,            // 'user' | 'assistant' | 'tool'
    text:       text || '',
    surface,         // 'web' | 'telegram'
    tool_calls,
    created_at: FieldValue.serverTimestamp(),
  });
}

export async function listRecentMessages(userId, { limit = 20 } = {}) {
  const snap = await db()
    .collection('coach_messages')
    .where('user_id', '==', userId)
    .get();
  const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  rows.sort((a, b) => {
    const ta = a.created_at?.toMillis?.() || 0;
    const tb = b.created_at?.toMillis?.() || 0;
    return ta - tb; // oldest first for chat history
  });
  return rows.slice(-limit);
}

// ── Pairing codes (link Telegram <-> Web) ────────────────────────────────────

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// Web-side: generate a code that pairs the existing web user with a future
// Telegram user. The reverse of createPairingCode.
export async function createWebPairingCode(webUserId) {
  const code = genCode();
  await db().collection('coach_link_codes').doc(code).set({
    code,
    web_user_id: webUserId,
    direction:   'web_to_tg',
    used:        false,
    created_at:  FieldValue.serverTimestamp(),
    expires_at:  Timestamp.fromMillis(Date.now() + 15 * 60 * 1000),
  });
  return code;
}

// Telegram-side: claim a web-issued code. Migrates any Telegram-only data
// for this telegram_id into the web user, then attaches the telegram_id to
// the web user. Returns the merged user, or null on invalid/expired code.
export async function claimWebPairingCode(code, telegramUser) {
  if (!code || code.length < 4) return null;
  const ref = db().collection('coach_link_codes').doc(code.toUpperCase());
  const doc = await ref.get();
  if (!doc.exists) return null;
  const data = doc.data();
  if (data.used || !data.web_user_id) return null;
  if (data.expires_at?.toMillis?.() < Date.now()) return null;

  const webUser = await getUserById(data.web_user_id);
  if (!webUser) return null;

  // If a separate Telegram-only user exists, migrate their child data into
  // the web user and delete the orphan.
  const tgUser = await getUserByTelegramId(telegramUser.id);
  if (tgUser && tgUser.id !== webUser.id) {
    for (const col of ['coach_messages', 'coach_activity', 'coach_submissions', 'coach_summaries']) {
      const snap = await db().collection(col).where('user_id', '==', tgUser.id).get();
      for (const child of snap.docs) {
        await child.ref.update({ user_id: webUser.id });
      }
    }

    // Merge user-level state — keep web user as the canonical record but
    // pick up anything useful from the Telegram user.
    const merged = {
      streak_count: Math.max(webUser.streak_count || 0, tgUser.streak_count || 0),
      xp:           (webUser.xp || 0) + (tgUser.xp || 0),
    };
    if (!webUser.avatar_url && tgUser.avatar_url) merged.avatar_url = tgUser.avatar_url;
    if (!webUser.role && tgUser.role)             merged.role = tgUser.role;
    if (!webUser.goal && tgUser.goal)             merged.goal = tgUser.goal;
    if (!webUser.learning_path_id && tgUser.learning_path_id) merged.learning_path_id = tgUser.learning_path_id;
    await updateUser(webUser.id, merged);

    // Migrate brain memory if the web user has none yet
    const tgMem = await db().collection('coach_memory').doc(tgUser.id).get();
    if (tgMem.exists) {
      const wMem = await db().collection('coach_memory').doc(webUser.id).get();
      if (!wMem.exists) {
        await db().collection('coach_memory').doc(webUser.id).set(tgMem.data());
      }
      await tgMem.ref.delete();
    }

    await db().collection('coach_users').doc(tgUser.id).delete();
  }

  await updateUser(webUser.id, { telegram_id: String(telegramUser.id) });
  await ref.update({
    used:           true,
    used_at:        FieldValue.serverTimestamp(),
    linked_user_id: webUser.id,
  });
  await logActivity(webUser.id, 'paired_web_to_telegram');

  try {
    const { checkPairedAchievement } = await import('./gamification.js');
    const fresh = await getUserById(webUser.id);
    if (fresh) await checkPairedAchievement(fresh);
  } catch {}

  return await getUserById(webUser.id);
}

// Telegram-side: generate a code that pairs the Telegram user with a future
// web visitor who enters the same code.
export async function createPairingCode(telegramUserId) {
  const code = genCode();
  await db().collection('coach_link_codes').doc(code).set({
    code,
    telegram_user_id: String(telegramUserId),
    used:             false,
    created_at:       FieldValue.serverTimestamp(),
    expires_at:       Timestamp.fromMillis(Date.now() + 15 * 60 * 1000),
  });
  return code;
}

// Web-side: consume a code, returning the linked user_id (or null on invalid).
// Also migrates any anonymous web user (same web_session_id) into the
// Telegram user — messages, activity, submissions all move over so the user
// keeps their history after pairing. The orphan anon user is deleted.
export async function consumePairingCode(code, webSessionId) {
  if (!code || code.length < 4) return null;
  const ref = db().collection('coach_link_codes').doc(code.toUpperCase());
  const doc = await ref.get();
  if (!doc.exists) return null;
  const data = doc.data();
  if (data.used) return null;
  if (data.expires_at?.toMillis?.() < Date.now()) return null;

  const user = await getUserByTelegramId(data.telegram_user_id);
  if (!user) return null;

  // Find any existing user with this web_session_id (the anonymous web user
  // the visitor was using before they pasted the code).
  const orphanSnap = await db()
    .collection('coach_users')
    .where('web_session_id', '==', webSessionId)
    .get();

  for (const orphan of orphanSnap.docs) {
    if (orphan.id === user.id) continue;
    // Migrate child rows from orphan → telegram user
    for (const col of ['coach_messages', 'coach_activity', 'coach_submissions', 'coach_summaries']) {
      const childSnap = await db().collection(col).where('user_id', '==', orphan.id).get();
      for (const child of childSnap.docs) {
        await child.ref.update({ user_id: user.id });
      }
    }
    await orphan.ref.delete();
  }

  await ref.update({
    used:            true,
    web_session_id:  webSessionId,
    used_at:         FieldValue.serverTimestamp(),
    linked_user_id:  user.id,
  });
  await updateUser(user.id, { web_session_id: webSessionId });
  await logActivity(user.id, 'paired_telegram_to_web');
  try {
    const { checkPairedAchievement } = await import('./gamification.js');
    const latest = await getUserById(user.id);
    if (latest) await checkPairedAchievement(latest);
  } catch {}
  return user.id;
}

// Web-side anonymous session helper.
export async function getOrCreateWebUser(webSessionId) {
  if (!webSessionId) return null;
  const snap = await db()
    .collection('coach_users')
    .where('web_session_id', '==', webSessionId)
    .limit(1)
    .get();
  if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };

  const ref = await db().collection('coach_users').add({
    telegram_id:        `web_${webSessionId}`,
    web_session_id:     webSessionId,
    full_name:          '',
    preferred_language: 'en',
    role:               null,
    goal:               null,
    learning_path_id:   null,
    status:             'onboarding',
    streak_count:       0,
    onboarding_step:    'language',
    surface:            'web',
    created_at:         FieldValue.serverTimestamp(),
    updated_at:         FieldValue.serverTimestamp(),
  });
  const doc = await ref.get();
  return { id: doc.id, ...doc.data() };
}

export async function getUserById(userId) {
  if (!userId) return null;
  const doc = await db().collection('coach_users').doc(userId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

// ── User-flagged reply reports ───────────────────────────────────────────────

export async function addReport({ user_id, message_text, last_user_text, reason, surface }) {
  const ref = await db().collection('coach_reports').add({
    user_id,
    message_text:    String(message_text || '').slice(0, 4000),
    last_user_text:  String(last_user_text || '').slice(0, 1000),
    reason:          String(reason || '').slice(0, 500),
    surface:         surface || 'web',
    status:          'open',
    created_at:      FieldValue.serverTimestamp(),
  });
  return { id: ref.id };
}

export async function listReports({ limit = 100 } = {}) {
  const snap = await db().collection('coach_reports')
    .orderBy('created_at', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function setReportStatus(id, status) {
  await db().collection('coach_reports').doc(id).update({
    status,
    reviewed_at: FieldValue.serverTimestamp(),
  });
}

// Returns the most recent assistant message for a user (for /report on Telegram)
export async function getLatestAssistantMessage(userId) {
  const snap = await db().collection('coach_messages')
    .where('user_id', '==', userId)
    .where('role', '==', 'assistant')
    .get();
  if (snap.empty) return null;
  const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  rows.sort((a, b) => {
    const ta = a.created_at?.toMillis?.() || 0;
    const tb = b.created_at?.toMillis?.() || 0;
    return tb - ta;
  });
  return rows[0];
}

// And the most recent user message immediately preceding it (for context)
export async function getLatestUserMessage(userId) {
  const snap = await db().collection('coach_messages')
    .where('user_id', '==', userId)
    .where('role', '==', 'user')
    .get();
  if (snap.empty) return null;
  const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  rows.sort((a, b) => {
    const ta = a.created_at?.toMillis?.() || 0;
    const tb = b.created_at?.toMillis?.() || 0;
    return tb - ta;
  });
  return rows[0];
}

// ── Activity log ───────────────────────────────────────────────────────────────

export async function logActivity(userId, eventType, metadata = {}) {
  await db().collection('coach_activity').add({
    user_id:    userId || null,
    event_type: eventType,
    metadata,
    created_at: FieldValue.serverTimestamp(),
  });
}

export async function listRecentActivity({ limit = 50 } = {}) {
  const snap = await db()
    .collection('coach_activity')
    .orderBy('created_at', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── Weekly summaries ───────────────────────────────────────────────────────────

export async function createWeeklySummary(data) {
  const ref = await db().collection('coach_summaries').add({
    user_id:          data.user_id,
    week_start_date:  data.week_start_date,
    completion_rate:  data.completion_rate ?? 0,
    strengths_text:   data.strengths_text || '',
    gaps_text:        data.gaps_text || '',
    next_focus_text:  data.next_focus_text || '',
    created_at:       FieldValue.serverTimestamp(),
  });
  return { id: ref.id };
}

// ── Aggregate stats for admin overview ────────────────────────────────────────

export async function adminOverviewStats() {
  const firestore = db();
  const since = new Date(Date.now() - 7 * 86400000);

  const [usersSnap, subsSnap, pathsSnap, actSnap] = await Promise.all([
    firestore.collection('coach_users').get(),
    firestore.collection('coach_submissions').get(),
    firestore.collection('coach_paths').where('status', '==', 'active').get(),
    firestore.collection('coach_activity').where('created_at', '>=', since).get(),
  ]);

  const activeUserIds = new Set();
  actSnap.docs.forEach(d => {
    const uid = d.data().user_id;
    if (uid) activeUserIds.add(uid);
  });

  const scores = subsSnap.docs
    .map(d => d.data().total_score)
    .filter(s => typeof s === 'number');
  const avgScore = scores.length
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
    : null;

  return {
    totalUsers:       usersSnap.size,
    weeklyActiveUsers: activeUserIds.size,
    totalSubmissions: subsSnap.size,
    activePaths:      pathsSnap.size,
    avgScore,
  };
}
