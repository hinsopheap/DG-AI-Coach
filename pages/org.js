import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Avatar from '../components/Avatar';
import DashboardShell from '../components/DashboardShell';

export default function OrgPage() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [createName, setCreateName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  async function load() {
    try {
      const res = await fetch('/api/org/dashboard');
      const j = await res.json();
      if (j.ok) setData(j);
      else setErr(j.error || 'Could not load team');
    } catch { setErr('Network error'); }
  }
  useEffect(() => { load(); }, []);

  async function createTeam(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/org/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: createName }),
      });
      const j = await res.json();
      if (!j.ok) setErr(j.error || 'Could not create team');
      else { setCreateName(''); load(); }
    } finally { setBusy(false); }
  }
  async function joinTeam(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/org/join', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: joinCode }),
      });
      const j = await res.json();
      if (!j.ok) setErr(j.error || 'Could not join');
      else { setJoinCode(''); load(); }
    } finally { setBusy(false); }
  }
  async function leaveTeam() {
    if (!confirm('Leave this team? Your personal progress stays — only team membership is removed.')) return;
    setBusy(true);
    try {
      await fetch('/api/org/leave', { method: 'POST' });
      load();
    } finally { setBusy(false); }
  }
  function copyCode() {
    if (!data?.org?.invite_code) return;
    navigator.clipboard?.writeText(data.org.invite_code).catch(() => {});
  }

  if (!data) return <DashboardShell active="team"><div style={s.empty}>{err || 'Loading…'}</div></DashboardShell>;

  // ── No team yet ─────────────────────────────────────────────────────────
  if (!data.in_org) {
    return (
      <>
        <Head><title>Team · DG AI Coach</title></Head>
        <DashboardShell active="team">
          <h1 style={s.h1}>Team coaching</h1>
          <p style={s.lede}>Coach your team together. The coach learns the team context. You see who's active, who's stuck, and where the wins are landing.</p>

          <div style={s.twoCol}>
            <section style={s.card}>
              <h2 style={s.h2}>Start a team</h2>
              <p style={s.muted}>You become the owner. Share the team code with people you want to coach.</p>
              <form onSubmit={createTeam} style={s.form}>
                <label style={s.label}>Team name</label>
                <input style={s.input} value={createName} onChange={e => setCreateName(e.target.value)} placeholder="e.g. Acme Logistics leadership" maxLength={80} required />
                <button type="submit" disabled={busy} style={{ ...s.primary, opacity: busy ? 0.5 : 1 }}>
                  {busy ? 'Creating…' : 'Create team'}
                </button>
              </form>
            </section>

            <section style={s.card}>
              <h2 style={s.h2}>Join a team</h2>
              <p style={s.muted}>Got a team code from someone? Paste it here.</p>
              <form onSubmit={joinTeam} style={s.form}>
                <label style={s.label}>Team code</label>
                <input style={{ ...s.input, fontFamily: 'monospace', letterSpacing: 3, textAlign: 'center', textTransform: 'uppercase' }} value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 8))} placeholder="ABC123" maxLength={8} required />
                <button type="submit" disabled={busy} style={{ ...s.secondary, opacity: busy ? 0.5 : 1 }}>
                  {busy ? 'Joining…' : 'Join team'}
                </button>
              </form>
            </section>
          </div>

          {err && <div style={s.err}>{err}</div>}
        </DashboardShell>
      </>
    );
  }

  // ── Member view ─────────────────────────────────────────────────────────
  if (data.role === 'member') {
    return (
      <>
        <Head><title>Team · DG AI Coach</title></Head>
        <DashboardShell active="team">
          <h1 style={s.h1}>{data.org.name}</h1>
          <p style={s.lede}>You're a member of this team. The coach knows you're learning together.</p>

          <section style={s.card}>
            <div style={s.codeRow}>
              <div>
                <div style={s.muted}>Team code</div>
                <div style={s.bigCode}>{data.org.invite_code}</div>
              </div>
              <button onClick={copyCode} style={s.secondary}>Copy code</button>
            </div>
          </section>

          <button onClick={leaveTeam} disabled={busy} style={{ ...s.ghost, marginTop: 24 }}>
            Leave team
          </button>
        </DashboardShell>
      </>
    );
  }

  // ── Owner view ──────────────────────────────────────────────────────────
  const o = data.org;
  return (
    <>
      <Head><title>{o.name} · DG AI Coach</title></Head>
      <DashboardShell active="team">
        <h1 style={s.h1}>{o.name}</h1>
        <p style={s.lede}>You own this team. Share the code below to invite people.</p>

        <section style={s.card}>
          <div style={s.codeRow}>
            <div>
              <div style={s.muted}>Team code</div>
              <div style={s.bigCode}>{o.invite_code}</div>
            </div>
            <button onClick={copyCode} style={s.primary}>Copy code</button>
          </div>
          <div style={{ marginTop: 14, fontSize: 13, color: '#7A7670' }}>
            Direct signup link with the code pre-filled:
            <div style={{ marginTop: 6 }}>
              <code style={s.linkCode}>{`${typeof window !== 'undefined' ? window.location.origin : 'https://dgaicoach.vercel.app'}/signup?org=${o.invite_code}`}</code>
            </div>
          </div>
        </section>

        <div style={s.statsGrid}>
          <Stat label="Members" value={o.member_count} />
          <Stat label="Total XP" value={o.total_xp.toLocaleString()} />
          <Stat label="Submissions" value={o.total_submissions} />
          <Stat label="Avg streak" value={`${o.avg_streak}d`} />
        </div>

        <h2 style={{ ...s.h2, marginTop: 32 }}>Members</h2>
        <div style={s.card}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Name</th>
                <th style={s.th}>Role</th>
                <th style={s.th}>XP</th>
                <th style={s.th}>Streak</th>
                <th style={s.th}>Submissions</th>
              </tr>
            </thead>
            <tbody>
              {o.members.map(m => (
                <tr key={m.id}>
                  <td style={s.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar kind="user" size={28} name={m.full_name} src={m.avatar_url} />
                      <div>
                        <div style={{ fontWeight: 500 }}>{m.full_name || <em style={{ color: '#999' }}>—</em>}</div>
                        {m.org_role === 'owner' && <div style={{ fontSize: 11, color: '#C96442', fontWeight: 600 }}>OWNER</div>}
                      </div>
                    </div>
                  </td>
                  <td style={s.td}>{m.role || '—'}</td>
                  <td style={s.td}>{(m.xp || 0).toLocaleString()}</td>
                  <td style={s.td}>{m.streak_count}d</td>
                  <td style={s.td}>{m.submissions}</td>
                </tr>
              ))}
              {o.members.length === 0 && (
                <tr><td style={s.td} colSpan={5}><em>No members yet. Share the team code.</em></td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 24, color: '#9B9690', fontSize: 13 }}>
          Pilot scope: members' personal coaching conversations are private. You see aggregate progress, not their individual chats.
        </div>
      </DashboardShell>
    </>
  );
}

function Stat({ label, value }) {
  return (
    <div style={s.stat}>
      <div style={s.statLabel}>{label}</div>
      <div style={s.statValue}>{value}</div>
    </div>
  );
}

const SURFACE = '#FFFFFF';
const BORDER  = '#EBE8DD';
const TEXT    = '#2A2925';
const MUTED   = '#7A7670';
const ACCENT  = '#C96442';

const s = {
  empty:      { textAlign: 'center', color: MUTED, padding: '80px 20px', fontSize: 14 },
  h1:         { margin: '0 0 8px', fontSize: 26, fontWeight: 600, letterSpacing: -0.4 },
  h2:         { margin: '0 0 12px', fontSize: 17, fontWeight: 600 },
  lede:       { margin: '0 0 28px', color: MUTED, fontSize: 14, lineHeight: 1.5 },
  twoCol:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 },
  card:       { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 22 },
  form:       { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 },
  label:      { fontSize: 12, color: '#5A5A55', fontWeight: 500 },
  input:      { padding: '10px 14px', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 14, background: '#FEFDFA' },
  muted:      { color: MUTED, fontSize: 13, margin: 0 },
  primary:    { background: ACCENT, color: '#fff', border: 'none', padding: '10px 16px', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', marginTop: 8 },
  secondary:  { background: SURFACE, border: `1px solid ${BORDER}`, color: TEXT, padding: '10px 16px', borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer', marginTop: 8 },
  ghost:      { background: 'transparent', color: '#c44', border: `1px solid #f0caca`, padding: '8px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer' },
  err:        { background: '#FEE2E2', color: '#991B1B', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginTop: 16 },

  codeRow:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  bigCode:    { fontSize: 28, fontWeight: 700, letterSpacing: 4, color: ACCENT, fontFamily: 'monospace', marginTop: 4 },
  linkCode:   { background: '#F0EEE6', padding: '4px 8px', borderRadius: 4, fontSize: 12, fontFamily: 'monospace', display: 'inline-block', wordBreak: 'break-all' },

  statsGrid:  { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginTop: 24 },
  stat:       { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 16 },
  statLabel:  { fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue:  { fontSize: 24, fontWeight: 600, marginTop: 4 },

  table:      { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th:         { textAlign: 'left', padding: '8px 0', borderBottom: '1px solid #eee', color: '#666', fontWeight: 500 },
  td:         { padding: '12px 0', borderBottom: '1px solid #f3f3f3' },
};
