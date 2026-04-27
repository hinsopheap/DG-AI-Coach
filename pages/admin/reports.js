import { useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import { requireAdmin } from '../../lib/auth';
import { listReports } from '../../lib/firebase';

export async function getServerSideProps({ req, res }) {
  if (!requireAdmin(req, res)) return { props: {} };
  const reports = await listReports({ limit: 200 });
  return {
    props: {
      reports: reports.map(r => ({
        id:             r.id,
        user_id:        r.user_id || '',
        message_text:   r.message_text || '',
        last_user_text: r.last_user_text || '',
        reason:         r.reason || '',
        surface:        r.surface || '',
        status:         r.status || 'open',
        created_at:     r.created_at?.toDate?.().toISOString() || null,
      })),
    },
  };
}

export default function Reports({ reports }) {
  const [rows, setRows] = useState(reports);
  const [filter, setFilter] = useState('open');

  async function setStatus(id, status) {
    await fetch('/api/admin/report-status', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id, status }),
    });
    setRows(rs => rs.map(r => (r.id === id ? { ...r, status } : r)));
  }

  const visible = rows.filter(r => filter === 'all' || r.status === filter);
  const counts = {
    open:     rows.filter(r => r.status === 'open').length,
    reviewed: rows.filter(r => r.status === 'reviewed').length,
    fixed:    rows.filter(r => r.status === 'fixed').length,
    all:      rows.length,
  };

  return (
    <AdminLayout active="/admin/reports">
      <div style={head}>
        <h1 style={{ margin: 0 }}>Reported replies</h1>
        <div style={tabs}>
          {['open', 'reviewed', 'fixed', 'all'].map(t => (
            <button
              key={t}
              style={{ ...tab, ...(filter === t ? tabActive : {}) }}
              onClick={() => setFilter(t)}
            >
              {t} ({counts[t] || 0})
            </button>
          ))}
        </div>
      </div>
      <p style={{ color: '#666', fontSize: 13, marginTop: 0 }}>
        Replies learners flagged as wrong. Each one is a chance to tighten the system prompt.
      </p>

      <div style={card}>
        {visible.length === 0 && <em style={{ color: '#999' }}>Nothing in this bucket.</em>}
        {visible.map(r => (
          <div key={r.id} style={rowStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <div>
                <span style={{ ...badge, background: surfaceColor(r.surface) }}>{r.surface}</span>
                <span style={{ ...statusBadge, ...statusColor(r.status) }}>{r.status}</span>
                <span style={{ color: '#999', fontSize: 11, marginLeft: 8 }}>
                  {r.created_at ? new Date(r.created_at).toLocaleString() : '—'} · user {r.user_id?.slice(0, 8)}…
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {r.status !== 'reviewed' && <button onClick={() => setStatus(r.id, 'reviewed')} style={miniBtn}>Mark reviewed</button>}
                {r.status !== 'fixed'    && <button onClick={() => setStatus(r.id, 'fixed')} style={miniBtnGreen}>Mark fixed</button>}
                {r.status !== 'open'     && <button onClick={() => setStatus(r.id, 'open')} style={miniBtnGray}>Reopen</button>}
              </div>
            </div>

            {r.last_user_text && (
              <div style={{ ...quote, background: '#111', color: '#fff' }}>
                <div style={miniLabel}>USER SAID</div>
                {r.last_user_text}
              </div>
            )}
            <div style={{ ...quote, background: '#FFF8F0', color: '#2A2925', borderLeft: '3px solid #C96442' }}>
              <div style={miniLabel}>COACH REPLIED</div>
              {r.message_text}
            </div>
            {r.reason && (
              <div style={{ marginTop: 8, fontSize: 13, color: '#5A5A55', fontStyle: 'italic' }}>
                <span style={{ color: '#999' }}>learner reason: </span>{r.reason}
              </div>
            )}
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}

function surfaceColor(s) { return s === 'telegram' ? '#229ED9' : '#7C3AED'; }
function statusColor(s) {
  if (s === 'reviewed') return { color: '#92400E', background: '#FEF3C7' };
  if (s === 'fixed')    return { color: '#065F46', background: '#D1FAE5' };
  return { color: '#991B1B', background: '#FEE2E2' };
}

const head      = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 };
const tabs      = { display: 'flex', gap: 6, flexWrap: 'wrap' };
const tab       = { background: '#fff', border: '1px solid #ddd', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', textTransform: 'capitalize' };
const tabActive = { background: '#111', color: '#fff', borderColor: '#111' };
const card      = { background: '#fff', borderRadius: 10, padding: 6, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' };
const rowStyle  = { padding: 16, borderBottom: '1px solid #f3f3f3' };
const badge     = { color: '#fff', fontSize: 10, padding: '2px 8px', borderRadius: 999, fontWeight: 600, marginRight: 6, textTransform: 'uppercase', letterSpacing: 0.5 };
const statusBadge = { fontSize: 10, padding: '2px 8px', borderRadius: 999, fontWeight: 600, marginRight: 6, textTransform: 'uppercase', letterSpacing: 0.5 };
const quote     = { padding: 10, borderRadius: 8, fontSize: 13, lineHeight: 1.5, marginBottom: 8, whiteSpace: 'pre-wrap' };
const miniLabel = { fontSize: 9, opacity: 0.7, fontWeight: 600, letterSpacing: 1, marginBottom: 4 };
const miniBtn   = { background: '#fff', border: '1px solid #ddd', padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer' };
const miniBtnGreen = { ...miniBtn, color: '#065F46', borderColor: '#A7F3D0' };
const miniBtnGray  = { ...miniBtn, color: '#666' };
