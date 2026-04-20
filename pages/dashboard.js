import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Avatar from '../components/Avatar';
import DashboardShell from '../components/DashboardShell';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    fetch('/api/chat/dashboard')
      .then(r => r.json())
      .then(d => {
        if (!d.ok) { setErr(d.error || 'Could not load dashboard'); return; }
        setData(d);
      })
      .catch(() => setErr('Network error'));
  }, []);

  if (err) return <DashboardShell active="dashboard"><div style={s.empty}>{err}</div></DashboardShell>;
  if (!data) return <DashboardShell active="dashboard"><div style={s.empty}>Loading…</div></DashboardShell>;

  const userWithLevel = { ...data.user, streak_count: data.stats.streak, xp_level: { level: data.xp.level, level_name: data.xp.level_name } };

  return (
    <>
      <Head>
        <title>Dashboard · DG AI Coach</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#FAF9F5" />
      </Head>
      <DashboardShell user={userWithLevel} active="dashboard">

        <section style={s.hero}>
          <div style={s.heroLeft}>
            <Avatar kind="user" size={64} name={data.user.full_name} src={data.user.avatar_url} />
            <div>
              <div style={s.welcome}>Welcome back{data.user.full_name ? `, ${data.user.full_name.split(' ')[0]}` : ''}</div>
              <div style={s.subline}>
                {data.path ? data.path.title : 'No learning path yet'}
                {data.path && ' · '}
                {data.user.paired_telegram ? 'Telegram + Web' : 'Web only'}
              </div>
            </div>
          </div>
          <div style={s.heroRight}>
            <div style={s.levelTag}>
              <span style={s.levelEmoji}>{levelEmoji(data.xp.level)}</span>
              <div>
                <div style={s.levelNum}>Level {data.xp.level}</div>
                <div style={s.levelNameStyle}>{data.xp.level_name}</div>
              </div>
            </div>
          </div>
        </section>

        <section style={s.xpCard}>
          <div style={s.xpRow}>
            <div>
              <div style={s.xpHeading}>{data.xp.total.toLocaleString()} XP</div>
              <div style={s.xpSub}>{data.xp.to_next > 0 ? `${data.xp.to_next} XP to Level ${data.xp.level + 1}` : 'Max level — for now.'}</div>
            </div>
            <Link href="/chat" style={s.primaryBtn}>Continue coaching →</Link>
          </div>
          <div style={s.xpBar}>
            <div style={{ ...s.xpBarFill, width: `${Math.round(data.xp.progress * 100)}%` }} />
          </div>
          <div style={s.xpTicks}>
            <span>{data.xp.floor.toLocaleString()}</span>
            <span>{data.xp.ceil.toLocaleString()}</span>
          </div>
        </section>

        <section style={s.statsGrid}>
          <Stat label="Tasks completed" value={data.stats.tasks_completed} suffix={data.stats.tasks_total ? `/${data.stats.tasks_total}` : ''} />
          <Stat label="Avg score" value={data.stats.average_score ?? '—'} suffix={data.stats.average_score != null ? '/10' : ''} />
          <Stat label="Current streak" value={data.stats.streak} suffix=" days" />
          <Stat label="Achievements" value={data.achievements.unlocked_count} suffix={`/${data.achievements.total}`} />
        </section>

        <section style={s.section}>
          <SectionHead title="🏆 Achievements" />
          <div style={s.achievementsGrid}>
            {data.achievements.catalog.map(a => (
              <div key={a.code} style={{ ...s.achievement, opacity: a.unlocked ? 1 : 0.42, filter: a.unlocked ? 'none' : 'grayscale(0.7)' }}>
                <div style={s.achievementIcon}>{a.icon}</div>
                <div style={s.achievementTitle}>{a.title}</div>
                <div style={s.achievementDesc}>{a.desc}</div>
                <div style={s.achievementXP}>+{a.xp} XP</div>
              </div>
            ))}
          </div>
        </section>

        {data.awards.length > 0 && (
          <section style={s.section}>
            <SectionHead title="🎖️ Awards from your coach" />
            <div style={s.awardsGrid}>
              {data.awards.map((a, i) => (
                <div key={i} style={s.awardCard}>
                  <div style={s.awardIcon}>{a.icon || '🎖️'}</div>
                  <div>
                    <div style={s.awardTitle}>{a.title}</div>
                    <div style={s.awardReason}>{a.reason || a.desc || ''}</div>
                    <div style={s.awardMeta}>+{a.xp || 0} XP · {a.given_at ? new Date(a.given_at).toLocaleDateString() : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {data.tasks.length > 0 && (
          <section style={s.section}>
            <SectionHead title={`📚 ${data.path?.title || 'Learning path'}`} subtitle={`${data.stats.tasks_completed} of ${data.tasks.length} complete`} />
            <div style={s.pathList}>
              {data.tasks.map(t => (
                <div key={t.id} style={s.pathRow}>
                  <div style={{ ...s.pathCheck, background: t.done ? '#059669' : '#fff', color: t.done ? '#fff' : '#ccc', borderColor: t.done ? '#059669' : '#EBE8DD' }}>
                    {t.done ? '✓' : t.sequence_order}
                  </div>
                  <div style={{ flex: 1, color: t.done ? '#7A7670' : '#2A2925', textDecoration: t.done ? 'line-through' : 'none' }}>
                    {t.title}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {data.recent_submissions.length > 0 && (
          <section style={s.section}>
            <SectionHead title="Recent submissions" />
            <div style={s.submissions}>
              {data.recent_submissions.map((sub, i) => (
                <div key={i} style={s.submissionRow}>
                  <div style={s.submissionScore}>{sub.total_score ?? '—'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={s.submissionTitle}>{sub.task_title || sub.task_id || 'Task'}</div>
                    <div style={s.submissionFeedback}>{sub.feedback}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </DashboardShell>
    </>
  );
}

function levelEmoji(level) {
  return ['', '🌱', '🌿', '🌳', '⭐', '✨', '🚀', '🏔️', '👑'][level] || '👑';
}

function Stat({ label, value, suffix }) {
  return (
    <div style={s.stat}>
      <div style={s.statLabel}>{label}</div>
      <div style={s.statValue}>{value}<span style={s.statSuffix}>{suffix}</span></div>
    </div>
  );
}

function SectionHead({ title, subtitle }) {
  return (
    <div style={s.sectionHead}>
      <div style={s.sectionTitle}>{title}</div>
      {subtitle && <div style={s.sectionSub}>{subtitle}</div>}
    </div>
  );
}

const BG       = '#FAF9F5';
const SURFACE  = '#FFFFFF';
const BORDER   = '#EBE8DD';
const TEXT     = '#2A2925';
const MUTED    = '#7A7670';
const ACCENT   = '#C96442';
const ACCENT_2 = '#D97757';

const s = {
  empty:       { textAlign: 'center', color: MUTED, padding: '80px 20px', fontSize: 14 },
  hero:        { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, marginBottom: 20, padding: 20, background: SURFACE, borderRadius: 16, border: `1px solid ${BORDER}`, flexWrap: 'wrap' },
  heroLeft:    { display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 200 },
  welcome:     { fontSize: 22, fontWeight: 600, letterSpacing: -0.3 },
  subline:     { fontSize: 13, color: MUTED, marginTop: 2 },
  heroRight:   { display: 'flex', alignItems: 'center', gap: 12 },
  levelTag:    { display: 'flex', alignItems: 'center', gap: 10, background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_2})`, color: '#fff', padding: '10px 16px', borderRadius: 12 },
  levelEmoji:  { fontSize: 28 },
  levelNum:    { fontSize: 12, opacity: 0.85, fontWeight: 500 },
  levelNameStyle: { fontSize: 16, fontWeight: 600, letterSpacing: -0.2 },
  xpCard:      { background: SURFACE, padding: 20, borderRadius: 16, border: `1px solid ${BORDER}`, marginBottom: 20 },
  xpRow:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12, flexWrap: 'wrap' },
  xpHeading:   { fontSize: 28, fontWeight: 700, letterSpacing: -0.5 },
  xpSub:       { fontSize: 13, color: MUTED, marginTop: 2 },
  primaryBtn:  { background: ACCENT, color: '#fff', padding: '10px 18px', borderRadius: 10, fontSize: 14, fontWeight: 500 },
  xpBar:       { height: 10, background: '#F3F0E7', borderRadius: 999, overflow: 'hidden' },
  xpBarFill:   { height: '100%', background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT_2})`, transition: 'width 0.5s' },
  xpTicks:     { display: 'flex', justifyContent: 'space-between', fontSize: 11, color: MUTED, marginTop: 6, fontFamily: 'ui-monospace, monospace' },
  statsGrid:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 28 },
  stat:        { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 },
  statLabel:   { fontSize: 12, color: MUTED, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue:   { fontSize: 26, fontWeight: 600, letterSpacing: -0.5 },
  statSuffix:  { fontSize: 14, color: MUTED, fontWeight: 500, marginLeft: 2 },
  section:     { marginBottom: 28 },
  sectionHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 },
  sectionTitle:{ fontSize: 16, fontWeight: 600 },
  sectionSub:  { fontSize: 12, color: MUTED },
  achievementsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 },
  achievement: { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, textAlign: 'center' },
  achievementIcon: { fontSize: 32, marginBottom: 6 },
  achievementTitle: { fontSize: 13, fontWeight: 600, marginBottom: 4 },
  achievementDesc: { fontSize: 11, color: MUTED, lineHeight: 1.4, minHeight: 30 },
  achievementXP: { fontSize: 11, color: ACCENT, marginTop: 6, fontWeight: 600 },
  awardsGrid:  { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 },
  awardCard:   { background: `linear-gradient(135deg, #FFF8F0, ${SURFACE})`, border: `1px solid #F5E1D0`, borderRadius: 12, padding: 14, display: 'flex', gap: 12 },
  awardIcon:   { fontSize: 28, lineHeight: 1, flexShrink: 0 },
  awardTitle:  { fontSize: 14, fontWeight: 600, color: ACCENT },
  awardReason: { fontSize: 13, color: TEXT, marginTop: 4, lineHeight: 1.4 },
  awardMeta:   { fontSize: 11, color: MUTED, marginTop: 6 },
  pathList:    { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 6 },
  pathRow:     { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 10px', borderBottom: `1px solid ${BORDER}` },
  pathCheck:   { width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, border: '1px solid', flexShrink: 0 },
  submissions: { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 6 },
  submissionRow: { display: 'flex', gap: 12, padding: '14px 10px', borderBottom: `1px solid ${BORDER}`, alignItems: 'flex-start' },
  submissionScore: { background: ACCENT, color: '#fff', width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, flexShrink: 0 },
  submissionTitle: { fontSize: 14, fontWeight: 600, marginBottom: 4 },
  submissionFeedback: { fontSize: 13, color: MUTED, lineHeight: 1.4 },
};
