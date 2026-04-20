import { useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { requireAdmin } from '../../lib/auth';
import { listUsers, listPaths } from '../../lib/firebase';

export async function getServerSideProps({ req, res }) {
  if (!requireAdmin(req, res)) return { props: {} };
  const [users, paths] = await Promise.all([listUsers(), listPaths()]);
  return {
    props: {
      users: users.map(u => ({
        id:               u.id,
        full_name:        u.full_name || '',
        role:             u.role || '',
        status:           u.status || '',
        streak_count:     u.streak_count || 0,
        last_task_date:   u.last_task_date || '',
        learning_path_id: u.learning_path_id || '',
        telegram_id:      u.telegram_id || '',
      })),
      paths: paths.map(p => ({ id: p.id, title: p.title })),
    },
  };
}

export default function Users({ users, paths }) {
  const [rows, setRows] = useState(users);
  const pathMap = Object.fromEntries(paths.map(p => [p.id, p.title]));

  async function assign(userId, pathId) {
    await fetch('/api/admin/assign-path', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, learning_path_id: pathId }),
    });
    setRows(r => r.map(u => (u.id === userId ? { ...u, learning_path_id: pathId, status: 'active' } : u)));
  }

  return (
    <AdminLayout active="/admin/users">
      <div style={header}>
        <h1 style={{ margin: 0 }}>Users</h1>
        <a href="/api/admin/export" style={btn}>Export CSV</a>
      </div>

      <div style={card}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Name</th>
              <th style={th}>Role</th>
              <th style={th}>Status</th>
              <th style={th}>Streak</th>
              <th style={th}>Last task</th>
              <th style={th}>Learning path</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(u => (
              <tr key={u.id}>
                <td style={td}>
                  <a href={`/admin/conversation/${u.id}`} style={{ color: '#111', textDecoration: 'none', fontWeight: 500 }}>
                    {u.full_name || <em style={{ color: '#999' }}>—</em>}
                  </a>
                  <div style={{ fontSize: 11, color: '#999' }}>
                    {u.telegram_id?.startsWith('web_') ? 'web' : `tg:${u.telegram_id}`}
                  </div>
                </td>
                <td style={td}>{u.role || '—'}</td>
                <td style={td}><Status value={u.status} /></td>
                <td style={td}>{u.streak_count}</td>
                <td style={td}>{u.last_task_date || '—'}</td>
                <td style={td}>
                  <select
                    value={u.learning_path_id}
                    onChange={e => assign(u.id, e.target.value)}
                    style={select}
                  >
                    <option value="">— unassigned —</option>
                    {paths.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td style={td} colSpan={6}><em>No users yet. Share your Telegram bot link to onboard.</em></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}

function Status({ value }) {
  const color = { active: '#0a7', onboarding: '#e9a100', waitlist: '#888', inactive: '#c44' }[value] || '#666';
  return <span style={{ color, fontWeight: 500, textTransform: 'capitalize' }}>{value || '—'}</span>;
}

const header = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 };
const btn = { padding: '8px 14px', background: '#111', color: '#fff', textDecoration: 'none', borderRadius: 8, fontSize: 13 };
const card = { background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' };
const table = { width: '100%', borderCollapse: 'collapse', fontSize: 14 };
const th = { textAlign: 'left', padding: '8px 0', borderBottom: '1px solid #eee', color: '#666', fontWeight: 500 };
const td = { padding: '10px 0', borderBottom: '1px solid #f3f3f3', verticalAlign: 'top' };
const select = { padding: '6px 8px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, background: '#fff' };
