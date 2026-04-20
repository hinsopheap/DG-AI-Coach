import { requireAdminApi } from '../../../lib/auth.js';
import { listUsers } from '../../../lib/firebase.js';

export default async function handler(req, res) {
  if (!requireAdminApi(req, res)) return;

  const users = await listUsers({ limit: 1000 });

  const header = ['id', 'full_name', 'role', 'goal', 'learning_path_id', 'status', 'streak_count', 'last_task_date'];
  const rows = users.map(u => header.map(h => JSON.stringify(u[h] ?? '')).join(','));

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="dg-ai-coach-users.csv"');
  res.status(200).send([header.join(','), ...rows].join('\n'));
}
