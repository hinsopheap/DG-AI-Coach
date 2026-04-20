import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Avatar from '../components/Avatar';
import DashboardShell from '../components/DashboardShell';

const ROLES = [
  { value: 'ceo',            label: 'CEO / Founder' },
  { value: 'gm',             label: 'GM / Director' },
  { value: 'senior_manager', label: 'Senior Manager' },
  { value: 'team_leader',    label: 'Team Leader' },
  { value: 'professional',   label: 'Professional' },
];

export default function Profile() {
  const [data, setData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState(null);
  const avatarFileRef = useRef(null);

  useEffect(() => {
    fetch('/api/chat/dashboard')
      .then(r => r.json())
      .then(d => { if (d.ok) setData(d); else setErr(d.error || 'Failed to load'); })
      .catch(() => setErr('Network error'));
  }, []);

  function setField(key, value) {
    setData(d => ({ ...d, user: { ...d.user, [key]: value } }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch('/api/chat/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name:          data.user.full_name,
          role:               data.user.role,
          goal:               data.user.goal,
          preferred_language: data.user.preferred_language,
        }),
      });
      const j = await res.json();
      if (!j.ok) setErr(j.error || 'Save failed');
      else setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function onAvatarPick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    const dataUrl = await readAsDataUrl(file);
    const resized = await resizeSquare(dataUrl, 96, 0.78);
    const res = await fetch('/api/chat/avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl: resized }),
    });
    const j = await res.json();
    if (j.ok) setData(d => ({ ...d, user: { ...d.user, avatar_url: j.avatar_url } }));
    else setErr(j.error || 'Could not upload avatar');
  }

  if (err && !data) return <DashboardShell active="profile"><div style={s.empty}>{err}</div></DashboardShell>;
  if (!data) return <DashboardShell active="profile"><div style={s.empty}>Loading…</div></DashboardShell>;

  const u = data.user;

  return (
    <>
      <Head>
        <title>Profile · DG AI Coach</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <DashboardShell user={{ ...u, streak_count: data.stats.streak, xp_level: { level: data.xp.level, level_name: data.xp.level_name } }} active="profile">

        <section style={s.card}>
          <h1 style={s.h1}>Your profile</h1>
          <p style={s.sub}>The coach uses this to tailor every reply. Keep it current.</p>

          <div style={s.avatarRow}>
            <Avatar kind="user" size={80} name={u.full_name} src={u.avatar_url} />
            <div>
              <button onClick={() => avatarFileRef.current?.click()} style={s.secondaryBtn}>Upload photo</button>
              <input ref={avatarFileRef} type="file" accept="image/*" onChange={onAvatarPick} style={{ display: 'none' }} />
              <div style={s.avatarHint}>Square images work best. Your Telegram profile photo is used by default when you pair.</div>
            </div>
          </div>

          <Field label="Full name">
            <input style={s.input} type="text" value={u.full_name || ''} onChange={e => setField('full_name', e.target.value)} maxLength={80} />
          </Field>

          <Field label="Role">
            <div style={s.rolePicker}>
              {ROLES.map(r => (
                <button
                  key={r.value}
                  onClick={() => setField('role', r.value)}
                  style={{ ...s.roleBtn, ...(u.role === r.value ? s.roleBtnActive : {}) }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Learning goal" hint="One sentence on what you want to get out of this.">
            <textarea style={{ ...s.input, minHeight: 64, fontFamily: 'inherit' }} value={u.goal || ''} onChange={e => setField('goal', e.target.value)} maxLength={300} />
          </Field>

          <Field label="Preferred language">
            <div style={s.langRow}>
              {[{ v: 'en', l: 'English' }, { v: 'km', l: 'ខ្មែរ Khmer' }].map(x => (
                <button
                  key={x.v}
                  onClick={() => setField('preferred_language', x.v)}
                  style={{ ...s.roleBtn, ...(u.preferred_language === x.v ? s.roleBtnActive : {}) }}
                >
                  {x.l}
                </button>
              ))}
            </div>
          </Field>

          <div style={s.saveRow}>
            <button onClick={save} disabled={saving} style={{ ...s.primaryBtn, opacity: saving ? 0.5 : 1 }}>
              {saving ? 'Saving…' : 'Save profile'}
            </button>
            {saved && <span style={s.savedTick}>✓ Saved</span>}
            {err && <span style={s.error}>{err}</span>}
          </div>
        </section>

        <section style={s.card}>
          <h2 style={s.h2}>Linked accounts</h2>
          <div style={s.linkedRow}>
            <div>
              <div style={s.linkedName}>Telegram</div>
              <div style={s.linkedSub}>
                {u.paired_telegram ? 'Linked to @dgaicoach_bot' : 'Not linked — open the bot and send /web'}
              </div>
            </div>
            <a href="https://t.me/dgaicoach_bot" target="_blank" rel="noreferrer" style={s.secondaryBtn}>
              {u.paired_telegram ? 'Open bot' : 'Link in Telegram'}
            </a>
          </div>
        </section>

        <div style={s.footer}>
          <Link href="/chat" style={{ color: '#7A7670', fontSize: 13 }}>← Back to chat</Link>
        </div>
      </DashboardShell>
    </>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={s.field}>
      <label style={s.label}>{label}</label>
      {children}
      {hint && <div style={s.hint}>{hint}</div>}
    </div>
  );
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}
function resizeSquare(dataUrl, size, quality) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
}

const SURFACE = '#FFFFFF';
const BORDER  = '#EBE8DD';
const TEXT    = '#2A2925';
const MUTED   = '#7A7670';
const ACCENT  = '#C96442';

const s = {
  empty:      { textAlign: 'center', color: MUTED, padding: '80px 20px', fontSize: 14 },
  card:       { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 28, marginBottom: 20 },
  h1:         { margin: '0 0 6px', fontSize: 24, fontWeight: 600, letterSpacing: -0.4 },
  h2:         { margin: '0 0 16px', fontSize: 18, fontWeight: 600 },
  sub:        { margin: '0 0 24px', color: MUTED, fontSize: 14 },
  avatarRow:  { display: 'flex', gap: 20, alignItems: 'center', marginBottom: 28, paddingBottom: 20, borderBottom: `1px solid ${BORDER}` },
  avatarHint: { color: MUTED, fontSize: 12, marginTop: 8 },
  field:      { marginBottom: 20 },
  label:      { display: 'block', fontSize: 13, fontWeight: 500, color: '#5A5A55', marginBottom: 6 },
  input:      { width: '100%', padding: '10px 14px', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 15, background: '#FEFDFA', color: TEXT, boxSizing: 'border-box' },
  hint:       { fontSize: 12, color: MUTED, marginTop: 4 },
  rolePicker: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  langRow:    { display: 'flex', gap: 8 },
  roleBtn:    { padding: '9px 14px', background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 999, fontSize: 13, cursor: 'pointer', color: TEXT },
  roleBtnActive: { background: ACCENT, color: '#fff', borderColor: ACCENT },
  saveRow:    { display: 'flex', alignItems: 'center', gap: 12, marginTop: 24, flexWrap: 'wrap' },
  primaryBtn: { background: ACCENT, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: 'pointer' },
  secondaryBtn: { display: 'inline-block', background: SURFACE, border: `1px solid ${BORDER}`, padding: '8px 14px', borderRadius: 10, fontSize: 13, cursor: 'pointer', color: TEXT, textDecoration: 'none' },
  savedTick:  { color: '#059669', fontSize: 13, fontWeight: 500 },
  error:      { color: '#DC2626', fontSize: 13 },
  linkedRow:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' },
  linkedName: { fontSize: 14, fontWeight: 600 },
  linkedSub:  { fontSize: 13, color: MUTED, marginTop: 2 },
  footer:     { textAlign: 'center', marginTop: 16 },
};
