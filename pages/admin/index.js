import AdminLayout from '../../components/AdminLayout';
import { requireAdmin } from '../../lib/auth';
import { adminOverviewStats, listRecentActivity } from '../../lib/firebase';

export async function getServerSideProps({ req, res }) {
  if (!requireAdmin(req, res)) return { props: {} };
  const [stats, activity] = await Promise.all([
    adminOverviewStats(),
    listRecentActivity({ limit: 20 }),
  ]);
  return {
    props: {
      stats,
      activity: activity.map(a => ({
        id:         a.id,
        event_type: a.event_type,
        user_id:    a.user_id || '',
        metadata:   a.metadata || {},
        created_at: a.created_at?.toDate?.().toISOString() || null,
      })),
    },
  };
}

export default function Overview({ stats, activity }) {
  return (
    <AdminLayout active="/admin">
      <h1 style={{ marginTop: 0 }}>Overview</h1>

      <div style={grid}>
        <Stat label="Total users" value={stats.totalUsers} />
        <Stat label="Weekly active users" value={stats.weeklyActiveUsers} />
        <Stat label="Submissions" value={stats.totalSubmissions} />
        <Stat label="Active paths" value={stats.activePaths} />
        <Stat label="Avg score" value={stats.avgScore ?? '—'} suffix={stats.avgScore ? '/10' : ''} />
      </div>

      <h2>Recent activity</h2>
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
            {activity.map(a => (
              <tr key={a.id}>
                <td style={td}>{a.created_at ? new Date(a.created_at).toLocaleString() : '—'}</td>
                <td style={td}>{a.user_id || '—'}</td>
                <td style={td}>{a.event_type}</td>
                <td style={td}>{JSON.stringify(a.metadata)}</td>
              </tr>
            ))}
            {activity.length === 0 && (
              <tr><td style={td} colSpan={4}><em>No activity yet.</em></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}

function Stat({ label, value, suffix }) {
  return (
    <div style={card}>
      <div style={{ color: '#888', fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600, marginTop: 6 }}>
        {value}{suffix || ''}
      </div>
    </div>
  );
}

const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 };
const card = { background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' };
const table = { width: '100%', borderCollapse: 'collapse', fontSize: 14 };
const th = { textAlign: 'left', padding: '8px 0', borderBottom: '1px solid #eee', color: '#666', fontWeight: 500 };
const td = { padding: '8px 0', borderBottom: '1px solid #f3f3f3', verticalAlign: 'top' };
