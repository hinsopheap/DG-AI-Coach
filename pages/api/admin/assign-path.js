import { requireAdminApi } from '../../../lib/auth.js';
import { updateUser, logActivity } from '../../../lib/firebase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  if (!requireAdminApi(req, res)) return;

  const { user_id, learning_path_id } = req.body || {};
  if (!user_id || !learning_path_id) {
    return res.status(400).json({ ok: false, error: 'user_id and learning_path_id required' });
  }

  await updateUser(user_id, { learning_path_id, status: 'active' });
  await logActivity(user_id, 'admin_path_assigned', { learning_path_id });

  return res.status(200).json({ ok: true });
}
