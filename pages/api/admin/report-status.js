import { requireAdminApi } from '../../../lib/auth.js';
import { setReportStatus } from '../../../lib/firebase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  if (!requireAdminApi(req, res)) return;

  const { id, status } = req.body || {};
  if (!id || !['open', 'reviewed', 'fixed'].includes(status)) {
    return res.status(400).json({ ok: false, error: 'Need id and valid status' });
  }
  await setReportStatus(id, status);
  return res.status(200).json({ ok: true });
}
