import { requireAdminApi } from '../../../lib/auth.js';
import { deleteMemory, logActivity } from '../../../lib/firebase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  if (!requireAdminApi(req, res)) return;

  const { user_id } = req.body || {};
  if (!user_id) return res.status(400).json({ ok: false, error: 'user_id required' });

  await deleteMemory(user_id);
  await logActivity(user_id, 'admin_memory_reset');
  return res.status(200).json({ ok: true });
}
