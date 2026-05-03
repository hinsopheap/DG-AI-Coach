// lib/org.js — team / org membership.
//
// Data model:
//   coach_orgs/{orgId}
//     name, invite_code (unique short), owner_id, created_at
//   coach_users.{org_id, org_role}  — denormalized on user doc for fast lookup
//
// Pilot scope: one user belongs to one org. Multi-org membership is out of
// scope until pilot signal justifies the complexity.

import crypto from 'crypto';
import { db, FieldValue, updateUser, getUserById } from './firebase.js';

function genCode() {
  // 6 chars, base32-like, easy to type and read aloud
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => alphabet[crypto.randomInt(0, alphabet.length)]).join('');
}

export async function findOrgByCode(code) {
  if (!code) return null;
  const snap = await db().collection('coach_orgs')
    .where('invite_code', '==', String(code).toUpperCase())
    .limit(1)
    .get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function getOrg(orgId) {
  if (!orgId) return null;
  const doc = await db().collection('coach_orgs').doc(orgId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

export async function createOrg({ name, owner_id }) {
  const cleanName = String(name || '').trim().slice(0, 80);
  if (!cleanName) throw new Error('name required');
  if (!owner_id) throw new Error('owner_id required');

  // Generate a unique code (rare collisions; retry up to 3x)
  let code;
  for (let i = 0; i < 3; i++) {
    const candidate = genCode();
    const existing = await findOrgByCode(candidate);
    if (!existing) { code = candidate; break; }
  }
  if (!code) throw new Error('could not generate unique invite code');

  const ref = await db().collection('coach_orgs').add({
    name:        cleanName,
    invite_code: code,
    owner_id,
    created_at:  FieldValue.serverTimestamp(),
  });

  await updateUser(owner_id, { org_id: ref.id, org_role: 'owner' });
  return { id: ref.id, name: cleanName, invite_code: code, owner_id };
}

export async function joinOrgByCode(userId, code) {
  const org = await findOrgByCode(code);
  if (!org) return { ok: false, reason: 'invalid_code' };

  await updateUser(userId, { org_id: org.id, org_role: 'member' });
  return { ok: true, org };
}

export async function leaveOrg(userId) {
  await updateUser(userId, { org_id: null, org_role: null });
  return { ok: true };
}

export async function listOrgMembers(orgId) {
  const snap = await db().collection('coach_users')
    .where('org_id', '==', orgId)
    .get();
  return snap.docs.map(d => {
    const u = d.data();
    return {
      id:               d.id,
      full_name:        u.full_name || '',
      role:             u.role || '',
      org_role:         u.org_role || 'member',
      streak_count:     u.streak_count || 0,
      xp:               u.xp || 0,
      avatar_url:       u.avatar_url || null,
    };
  });
}

// Aggregate stats for the owner's dashboard.
export async function orgDashboard(orgId) {
  const org = await getOrg(orgId);
  if (!org) return null;
  const members = await listOrgMembers(orgId);

  // Pull submissions for all members, in parallel but bounded
  const submissionCounts = await Promise.all(members.map(async m => {
    const snap = await db().collection('coach_submissions').where('user_id', '==', m.id).get();
    return { user_id: m.id, count: snap.size };
  }));
  const subMap = Object.fromEntries(submissionCounts.map(s => [s.user_id, s.count]));

  const totalSubs = Object.values(subMap).reduce((a, b) => a + b, 0);
  const totalXP = members.reduce((a, m) => a + (m.xp || 0), 0);
  const avgStreak = members.length
    ? Math.round(members.reduce((a, m) => a + (m.streak_count || 0), 0) / members.length * 10) / 10
    : 0;

  return {
    id:           org.id,
    name:         org.name,
    invite_code:  org.invite_code,
    owner_id:     org.owner_id,
    member_count: members.length,
    total_xp:     totalXP,
    total_submissions: totalSubs,
    avg_streak:   avgStreak,
    members:      members.map(m => ({ ...m, submissions: subMap[m.id] || 0 })),
  };
}
