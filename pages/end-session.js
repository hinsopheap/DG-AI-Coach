import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Avatar from '../components/Avatar';
import { t } from '../lib/i18n';

export default function EndSession() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    fetch('/api/auth/farewell')
      .then(r => r.json())
      .then(d => {
        if (!d.ok) { setErr(d.error || 'Could not load farewell'); return; }
        setData(d);
      })
      .catch(() => setErr('Network error'));
  }, []);

  return (
    <>
      <Head>
        <title>Until next time · DG AI Coach</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#FAF9F5" />
      </Head>
      <div style={s.page}>
        <div style={s.brand}>
          <Link href="/" style={s.brandLink}>
            <Avatar kind="coach" size={32} />
            <span style={s.brandName}>DG AI Coach</span>
          </Link>
        </div>

        {err && <div style={s.card}><div style={s.muted}>{err}</div></div>}

        {!err && !data && (
          <div style={s.card}>
            <div style={s.muted}>Gathering your session…</div>
          </div>
        )}

        {data && (
          <>
            <div style={s.card}>
              <div style={s.coachRow}>
                <Avatar kind="coach" size={56} />
                <div>
                  <h1 style={s.headline}>{data.farewell.headline}</h1>
                  <div style={s.coachNote}>A note from your coach</div>
                </div>
              </div>

              <div style={s.body}>
                {data.farewell.covered && <p style={s.paragraph}>{data.farewell.covered}</p>}
                {data.farewell.strength && <p style={s.paragraphAccent}><strong>{t(data.user.preferred_language, 'end.what_did_well')}</strong> {data.farewell.strength}</p>}
                {data.farewell.carry_home && <p style={s.paragraph}><strong>{t(data.user.preferred_language, 'end.before_next')}</strong> {data.farewell.carry_home}</p>}
                {data.farewell.hook && <p style={{ ...s.paragraph, fontStyle: 'italic', color: '#5A5A55', marginTop: 20 }}>{data.farewell.hook}</p>}
              </div>
            </div>

            <div style={s.statsCard}>
              <div style={s.statsTitle}>{t(data.user.preferred_language, 'end.where_you_stand')}</div>
              <div style={s.statsRow}>
                <Stat label="Level" value={`${data.stats.level}`} sub={data.stats.level_name} />
                <Stat label="XP" value={data.stats.xp_total.toLocaleString()} sub={data.stats.xp_to_next > 0 ? `${data.stats.xp_to_next} to L${data.stats.level + 1}` : 'Max'} />
                <Stat label="Streak" value={data.stats.streak} sub={data.stats.streak === 1 ? 'day' : 'days'} highlight />
              </div>
              <div style={s.xpBar}>
                <div style={{ ...s.xpBarFill, width: `${Math.round(data.stats.progress * 100)}%` }} />
              </div>
            </div>

            <div style={s.actions}>
              <Link href="/chat" style={s.primary}>{t(data.user.preferred_language, 'end.keep_coaching')}</Link>
              {!confirming ? (
                <button onClick={() => setConfirming(true)} style={s.ghost}>{t(data.user.preferred_language, 'end.end_session')}</button>
              ) : (
                <form action="/api/auth/signout" method="GET" style={{ display: 'inline-flex', gap: 8 }}>
                  <button type="submit" style={s.confirmDanger}>{t(data.user.preferred_language, 'end.confirm_signout')}</button>
                  <button type="button" onClick={() => setConfirming(false)} style={s.ghost}>{t(data.user.preferred_language, 'end.stay')}</button>
                </form>
              )}
            </div>

            {data.user.has_account && (
              <div style={s.footnote}>
                Your progress is saved. Come back anytime — sign in with your email and I'll pick up right where we left off.
              </div>
            )}
            {!data.user.has_account && (
              <div style={s.footnote}>
                <strong>Save your progress before you close.</strong> <Link href="/signup" style={s.link}>Create a free account</Link> and your memory, XP, and streak carry across devices.
              </div>
            )}
          </>
        )}

        <style jsx global>{`
          html, body { margin: 0; padding: 0; background: #FAF9F5; color: #2A2925; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Inter", sans-serif; -webkit-font-smoothing: antialiased; }
          a { color: #C96442; text-decoration: none; }
          button { transition: opacity 0.15s, background 0.15s, transform 0.05s; cursor: pointer; }
          button:active:not(:disabled) { transform: scale(0.98); }
        `}</style>
      </div>
    </>
  );
}

function Stat({ label, value, sub, highlight }) {
  return (
    <div style={s.stat}>
      <div style={s.statLabel}>{label}</div>
      <div style={{ ...s.statValue, color: highlight ? '#D97706' : '#2A2925' }}>{value}</div>
      <div style={s.statSub}>{sub}</div>
    </div>
  );
}

const SURFACE = '#FFFFFF';
const BORDER  = '#EBE8DD';
const TEXT    = '#2A2925';
const MUTED   = '#7A7670';
const ACCENT  = '#C96442';

const s = {
  page:       { minHeight: '100dvh', maxWidth: 640, margin: '0 auto', padding: '40px 20px 60px', display: 'flex', flexDirection: 'column', gap: 16 },
  brand:      { marginBottom: 8 },
  brandLink:  { display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: TEXT },
  brandName:  { fontWeight: 600, fontSize: 16, letterSpacing: -0.2 },

  card:       { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 18, padding: 28 },
  muted:      { color: MUTED, textAlign: 'center', padding: 20, fontSize: 14 },

  coachRow:   { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 },
  headline:   { margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: -0.4, lineHeight: 1.2 },
  coachNote:  { fontSize: 12, color: ACCENT, fontWeight: 500, letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 },

  body:       { color: TEXT, lineHeight: 1.65, fontSize: 15 },
  paragraph:  { margin: '14px 0' },
  paragraphAccent: { margin: '14px 0', padding: '14px 16px', background: '#FFF8F0', borderLeft: `3px solid ${ACCENT}`, borderRadius: 8 },

  statsCard:  { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 18, padding: 20 },
  statsTitle: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: MUTED, fontWeight: 600, marginBottom: 14 },
  statsRow:   { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 },
  stat:       { textAlign: 'center' },
  statLabel:  { fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  statValue:  { fontSize: 28, fontWeight: 700, letterSpacing: -0.5, lineHeight: 1 },
  statSub:    { fontSize: 11, color: MUTED, marginTop: 4 },
  xpBar:      { height: 6, background: '#F3F0E7', borderRadius: 999, overflow: 'hidden' },
  xpBarFill:  { height: '100%', background: `linear-gradient(90deg, ${ACCENT}, #D97757)` },

  actions:    { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', padding: '12px 0' },
  primary:    { display: 'inline-block', padding: '12px 22px', background: ACCENT, color: '#fff', borderRadius: 10, fontSize: 14, fontWeight: 500 },
  ghost:      { background: 'transparent', color: MUTED, border: `1px solid ${BORDER}`, padding: '12px 18px', borderRadius: 10, fontSize: 14, fontWeight: 500 },
  confirmDanger: { background: '#DC2626', color: '#fff', border: 'none', padding: '12px 18px', borderRadius: 10, fontSize: 14, fontWeight: 500 },
  footnote:   { textAlign: 'center', fontSize: 13, color: MUTED, padding: '8px 20px', lineHeight: 1.5 },
  link:       { color: ACCENT, fontWeight: 500 },
};
