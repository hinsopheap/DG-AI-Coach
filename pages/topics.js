import Head from 'next/head';
import Link from 'next/link';
import Avatar from '../components/Avatar';
import { TOPICS } from '../lib/topics';

const TRACK_LABELS = {
  people:        { en: 'People',        km: 'មនុស្ស' },
  communication: { en: 'Communication', km: 'ការប្រាស្រ័យទាក់ទង' },
  decisions:     { en: 'Decisions',     km: 'ការសម្រេចចិត្ត' },
  operations:    { en: 'Operations',    km: 'ប្រតិបត្តិការ' },
  strategy:      { en: 'Strategy',      km: 'យុទ្ធសាស្ត្រ' },
  responsible:   { en: 'Responsible AI',km: 'AI ទទួលខុសត្រូវ' },
};

export async function getServerSideProps() {
  // Server-render with EN by default for SEO. Users can switch language
  // inside the chat after they tap a topic.
  const topics = TOPICS.map(t => ({
    id:        t.id,
    track:     t.track,
    icon:      t.icon,
    label:     t.label_en,
    label_km:  t.label_km,
    prompt:    t.prompt_en,
    prompt_km: t.prompt_km,
  }));
  return { props: { topics } };
}

export default function TopicsPage({ topics }) {
  // Group by track for clean rendering
  const grouped = {};
  for (const t of topics) {
    if (!grouped[t.track]) grouped[t.track] = [];
    grouped[t.track].push(t);
  }

  return (
    <>
      <Head>
        <title>Topics — pick how you want to apply AI to your work · DG AI Coach</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#FAF9F5" />
        <meta name="description" content="Twelve practical topics to start coaching with DG AI Coach: communication, decisions, operations, people, strategy, responsible AI. Tap one to start." />
        <meta property="og:title" content="DG AI Coach — Topics" />
        <meta property="og:description" content="Pick a topic, start a coaching conversation. Web or Telegram." />
      </Head>
      <main style={s.page}>

        <nav style={s.nav}>
          <Link href="/" style={s.brandRow}>
            <Avatar kind="coach" size={32} />
            <span style={s.brandName}>DG AI Coach</span>
          </Link>
          <div style={s.navRight}>
            <Link href="/signin" style={s.navLink}>Sign in</Link>
            <Link href="/signup" style={s.navCta}>Sign up</Link>
          </div>
        </nav>

        <section style={s.hero}>
          <div style={s.eyebrow}>Topics</div>
          <h1 style={s.h1}>Pick how you want to apply AI to your work.</h1>
          <p style={s.lede}>
            Twelve concrete coaching threads — tap one and start. Each opens a real conversation with the coach, in English or Khmer, on web or Telegram.
          </p>
        </section>

        {Object.entries(grouped).map(([track, ts]) => (
          <section key={track} style={s.trackBlock}>
            <div style={s.trackEyebrow}>{TRACK_LABELS[track]?.en || track}</div>
            <div style={s.trackGrid}>
              {ts.map(t => {
                const webHref = `/chat?prompt=${encodeURIComponent(t.prompt)}&topic=${t.id}`;
                const tgHref  = `https://t.me/dgaicoach_bot?start=topic_${t.id}`;
                return (
                  <article key={t.id} style={s.card}>
                    <div style={s.cardIcon}>{t.icon}</div>
                    <h3 style={s.cardTitle}>{t.label}</h3>
                    <p style={s.cardKm}>{t.label_km}</p>
                    <p style={s.cardPrompt}>"{t.prompt}"</p>
                    <div style={s.cardActions}>
                      <Link href={webHref} style={s.primary}>Start on web →</Link>
                      <a href={tgHref} target="_blank" rel="noreferrer" style={s.secondary}>Telegram</a>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}

        <section style={s.cta}>
          <h2 style={s.ctaTitle}>Don't see your situation?</h2>
          <p style={s.ctaLede}>Open a conversation with the coach directly — describe what you're working on in your own words.</p>
          <div style={s.ctaRow}>
            <Link href="/chat" style={s.primary}>Open chat</Link>
            <a href="https://t.me/dgaicoach_bot" target="_blank" rel="noreferrer" style={s.secondary}>Open in Telegram</a>
          </div>
        </section>

        <footer style={s.footer}>
          <div>DG Academy · Cambodia AI Group · Phnom Penh</div>
          <div style={{ marginTop: 4, color: '#9B9690' }}>
            <Link href="/privacy" style={{ color: '#9B9690' }}>Privacy</Link>
            {' · '}
            <Link href="/terms" style={{ color: '#9B9690' }}>Terms</Link>
            {' · '}
            <a href="https://github.com/hinsopheap/DG-AI-Coach" target="_blank" rel="noreferrer" style={{ color: '#9B9690' }}>Source</a>
          </div>
        </footer>

        <style jsx global>{`
          html, body { margin: 0; padding: 0; background: #FAF9F5; color: #2A2925; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Inter", sans-serif; -webkit-font-smoothing: antialiased; }
          a { text-decoration: none; }
        `}</style>
      </main>
    </>
  );
}

const SURFACE = '#FFFFFF';
const BORDER  = '#EBE8DD';
const TEXT    = '#2A2925';
const MUTED   = '#7A7670';
const ACCENT  = '#C96442';

const s = {
  page:        { maxWidth: 1080, margin: '0 auto', padding: '20px 24px 60px' },
  nav:         { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40, padding: '6px 0' },
  brandRow:    { display: 'flex', alignItems: 'center', gap: 10, color: TEXT },
  brandName:   { fontWeight: 600, fontSize: 15, letterSpacing: -0.2 },
  navRight:    { display: 'flex', gap: 4 },
  navLink:     { padding: '8px 14px', fontSize: 13, color: TEXT, fontWeight: 500, borderRadius: 999 },
  navCta:      { padding: '8px 16px', fontSize: 13, color: '#fff', fontWeight: 500, borderRadius: 999, background: ACCENT },

  hero:        { textAlign: 'center', maxWidth: 720, margin: '24px auto 56px' },
  eyebrow:     { fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: ACCENT, fontWeight: 700, marginBottom: 16 },
  h1:          { fontSize: 'clamp(28px, 4.5vw, 44px)', lineHeight: 1.15, margin: '0 0 18px', letterSpacing: -1, fontWeight: 600 },
  lede:        { fontSize: 17, color: '#5A5A55', lineHeight: 1.55, margin: 0 },

  trackBlock:  { marginBottom: 56 },
  trackEyebrow:{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 2.5, color: MUTED, fontWeight: 700, marginBottom: 16, paddingLeft: 4 },
  trackGrid:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: 14 },
  card:        { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 22 },
  cardIcon:    { fontSize: 30, lineHeight: 1, marginBottom: 12 },
  cardTitle:   { fontSize: 18, fontWeight: 600, margin: '0 0 4px', letterSpacing: -0.2 },
  cardKm:      { fontSize: 13, color: MUTED, margin: '0 0 12px' },
  cardPrompt:  { fontSize: 14, color: '#4A4A47', lineHeight: 1.55, margin: '0 0 18px', fontStyle: 'italic' },
  cardActions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  primary:     { display: 'inline-block', padding: '9px 16px', background: ACCENT, color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 500 },
  secondary:   { display: 'inline-block', padding: '9px 16px', background: SURFACE, color: TEXT, borderRadius: 8, fontSize: 13, fontWeight: 500, border: `1px solid ${BORDER}` },

  cta:         { textAlign: 'center', padding: '48px 24px', background: SURFACE, borderRadius: 20, border: `1px solid ${BORDER}`, marginBottom: 40 },
  ctaTitle:    { fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 600, margin: '0 0 10px', letterSpacing: -0.4 },
  ctaLede:     { fontSize: 15, color: MUTED, margin: '0 0 24px' },
  ctaRow:      { display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' },

  footer:      { textAlign: 'center', color: MUTED, fontSize: 12, padding: '20px 0' },
};
