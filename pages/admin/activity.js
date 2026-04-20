import AdminLayout from '../../components/AdminLayout';
import { requireAdmin } from '../../lib/auth';
import { listRecentActivity } from '../../lib/firebase';

export async function getServerSideProps({ req, res }) {
  if (!requireAdmin(req, res)) return { props: {} };
  const events = await listRecentActivity({ limit: 200 });
  return {
    props: {
      events: events.map(e => ({
        id:         e.id,
        user_id:    e.user_id || '',
        event_type: e.event_type,
        metadata:   e.metadata || {},
        created_at: e.created_at?.toDate?.().toISOString() || null,
      })),
    },
  };
}

export default function Activity({ events }) {
  return (
    <AdminLayout active="/admin/activity">
      <h1 style={{ marginTop: 0 }}>Activity log</h1>
      <div style={card}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>When</th>
              <th style={th}>User</th>
              <th style={th}>Event</th>
              <th style={th}>Details</th>
            </tr>
          </thead>
          <tbody>
            {events.map(a => (
              <tr key={a.id}>
                <td style={td}>{a.created_at ? new Date(a.created_at).toLocaleString() : '—'}</td>
                <td style={td}>{a.user_id || '—'}</td>
                <td style={td}>{a.event_type}</td>
                <td style={{ ...td, color: '#666', fontFamily: 'monospace', fontSize: 12 }}>
                  {JSON.stringify(a.metadata)}
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr><td style={td} colSpan={4}><em>No activity yet.</em></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}

const card = { background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' };
const table = { width: '100%', borderCollapse: 'collapse', fontSize: 14 };
const th = { textAlign: 'left', padding: '8px 0', borderBottom: '1px solid #eee', color: '#666', fontWeight: 500 };
const td = { padding: '10px 0', borderBottom: '1px solid #f3f3f3', verticalAlign: 'top' };
