import AdminLayout from '../../components/AdminLayout';
import { requireAdmin } from '../../lib/auth';
import { listRecentErrors } from '../../lib/error-log';

export async function getServerSideProps({ req, res }) {
  if (!requireAdmin(req, res)) return { props: {} };
  const events = await listRecentErrors({ limit: 100 });
  return {
    props: {
      events: events.map(e => ({
        id:         e.id,
        scope:      e.scope || '',
        message:    e.message || '',
        stack:      e.stack || '',
        context:    e.context || {},
        created_at: e.created_at?.toDate?.().toISOString() || null,
      })),
    },
  };
}

export default function Errors({ events }) {
  return (
    <AdminLayout active="/admin/errors">
      <h1 style={{ marginTop: 0 }}>Errors</h1>
      <p style={{ color: '#666', fontSize: 13 }}>Last 100 server-side errors. Empty = good.</p>

      <div style={card}>
        {events.length === 0 && <em style={{ color: '#999' }}>No errors logged. ✓</em>}
        {events.map(e => (
          <div key={e.id} style={row}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ color: '#c44', fontWeight: 600, fontSize: 13 }}>{e.scope}</span>
              <span style={{ color: '#999', fontSize: 11 }}>
                {e.created_at ? new Date(e.created_at).toLocaleString() : '—'}
              </span>
            </div>
            <div style={{ fontSize: 14, marginTop: 6 }}>{e.message}</div>
            {Object.keys(e.context).length > 0 && (
              <div style={{ fontSize: 11, color: '#888', marginTop: 6, fontFamily: 'monospace' }}>
                {JSON.stringify(e.context)}
              </div>
            )}
            {e.stack && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: 'pointer', fontSize: 11, color: '#888' }}>stack</summary>
                <pre style={{ fontSize: 11, color: '#666', whiteSpace: 'pre-wrap', marginTop: 4 }}>{e.stack}</pre>
              </details>
            )}
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}

const card = { background: '#fff', borderRadius: 10, padding: 6, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' };
const row  = { padding: '12px 14px', borderBottom: '1px solid #f3f3f3' };
