import Head from 'next/head';
import Link from 'next/link';
import Avatar from '../components/Avatar';

export default function Home() {
  return (
    <>
      <Head>
        <title>DG AI Coach — apply AI to your real work, five minutes a day</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#FAF9F5" />
        <meta property="og:title" content="DG AI Coach" />
        <meta property="og:description" content="A senior AI coach in your pocket. Five focused minutes a day on Telegram or web." />
      </Head>
      <main style={s.page}>

        {/* ───── Top nav ───── */}
        <nav style={s.nav}>
          <Link href="/" style={s.brandRow}>
            <Avatar kind="coach" size={36} />
            <div>
              <div style={s.brandName}>DG AI Coach</div>
              <div style={s.brandTag}>by DG Academy · Phnom Penh</div>
            </div>
          </Link>
          <div style={s.navRight}>
            <Link href="/signin" style={s.navLink}>Sign in</Link>
            <Link href="/signup" style={s.navCta}>Sign up</Link>
          </div>
        </nav>

        {/* ───── Hero ───── */}
        <section style={s.hero}>
          <div style={s.heroText}>
            <div style={s.eyebrow}>Welcome to the age of AI acceleration</div>
            <h1 style={s.h1}>
              The professionals who thrive next <span style={s.accent}>won't</span> be the ones who know the most.
              They'll be the ones who <span style={s.accent}>learn fastest</span> and <span style={s.accent}>apply smartest</span>.
            </h1>
            <p style={s.lede}>
              DG AI Coach gives you five focused minutes a day with a senior AI coach — over Telegram or right here in your browser. Real frontier expertise. Real opinions. Real progress you can see.
            </p>
            <div style={s.ctaRow}>
              <Link href="/signup" style={s.primary}>Start free →</Link>
              <Link href="/signin" style={s.secondary}>I have an account</Link>
            </div>
            <div style={s.trust}>
              <TrustItem icon="🎯" text="5-min daily tasks" />
              <TrustItem icon="🏆" text="XP + achievements" />
              <TrustItem icon="🧠" text="Coach remembers you" />
              <TrustItem icon="💬" text="Web + Telegram" />
            </div>
          </div>

          <div style={s.coachCard}>
            <div style={s.photoFrame}>
              <img
                src="/coach.jpg"
                alt="Hin Sopheap"
                style={s.photo}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fb = e.currentTarget.nextElementSibling;
                  if (fb) fb.style.display = 'flex';
                }}
              />
              <div style={{ ...s.photoFallback, display: 'none' }}>HS</div>
            </div>
            <div style={s.coachMeta}>
              <div style={s.coachLabel}>Your coach</div>
              <div style={s.coachName}>Hin Sopheap</div>
              <div style={s.coachTitle}>AI &amp; Strategy Architect</div>
              <p style={s.coachBio}>
                Co-founder and Executive Director of DG Academy / Cambodia AI Group. Designs AI-native operating systems for leaders and their teams. This coach is his playbook, packaged.
              </p>
              <div style={s.coachLinks}>
                <a href="https://t.me/dgaicoach_bot" target="_blank" rel="noreferrer" style={s.coachLink}>Telegram</a>
                <a href="https://ai.angkorgate.ai" target="_blank" rel="noreferrer" style={s.coachLink}>DG Academy</a>
              </div>
            </div>
          </div>
        </section>

        {/* ───── Inspiring block ───── */}
        <section style={s.quoteBlock}>
          <div style={s.quoteMark}>"</div>
          <div style={s.quote}>
            AI is not replacing your work — it's raising the floor of what's possible. This coach won't teach you theory you'll forget. It will sit with you five minutes a day until AI becomes instinct in how you lead, decide, and ship.
          </div>
          <div style={s.quoteAttr}>— Hin Sopheap</div>
        </section>

        {/* ───── Features ───── */}
        <section style={s.features}>
          <Feature eyebrow="01" title="A brain that learns you"
            body="The coach remembers how you prompt, what you care about, and what you're working on. Every session builds on the last." />
          <Feature eyebrow="02" title="Opinionated, not hedgy"
            body="No three-option lists when you asked for an answer. The coach forms a point of view, states it, and moves you toward the next action in five minutes." />
          <Feature eyebrow="03" title="Practice, not theory"
            body={<>Direct links to <a href="https://dgchat.angkorgate.ai" target="_blank" rel="noreferrer">DG Chat</a>, <a href="https://aieureka.angkorgate.ai" target="_blank" rel="noreferrer">AI Eureka</a>, and <a href="https://ai.angkorgate.ai" target="_blank" rel="noreferrer">the AI portal</a> — with specific prompts to paste.</>} />
          <Feature eyebrow="04" title="XP, levels, achievements"
            body="Earn XP on every submission, streak bonuses, and rare coach-awarded prizes for sharp moments. Watch your level climb as the habit compounds." />
          <Feature eyebrow="05" title="Multimodal"
            body="Send a screenshot, a photo of your whiteboard, or a voice note. The coach sees and responds to images in both web and Telegram." />
          <Feature eyebrow="06" title="One coach, two surfaces"
            body={<>Send <code>/web</code> in the Telegram bot to get a code. Paste it in the web chat. Same memory, same progress, same XP.</>} />
        </section>

        {/* ───── CTA ───── */}
        <section style={s.cta}>
          <h2 style={s.ctaTitle}>Start your streak today.</h2>
          <p style={s.ctaLede}>No credit card. First task arrives right after signup.</p>
          <div style={s.ctaRow}>
            <Link href="/signup" style={s.primary}>Create your account</Link>
            <a href="https://t.me/dgaicoach_bot" target="_blank" rel="noreferrer" style={s.secondary}>Open in Telegram</a>
          </div>
        </section>

        <footer style={s.footer}>
          <div>DG Academy · Cambodia AI Group · Phnom Penh</div>
          <div style={{ marginTop: 4, color: '#9B9690' }}>
            Built with Next.js, Firestore, Claude ·{' '}
            <a href="https://github.com/hinsopheap/DG-AI-Coach" target="_blank" rel="noreferrer" style={{ color: '#9B9690' }}>Source on GitHub</a>
            {' · '}
            <Link href="/admin" style={{ color: '#9B9690' }}>Admin</Link>
          </div>
        </footer>

        <style jsx global>{`
          html, body { margin: 0; padding: 0; background: #FAF9F5; color: #2A2925; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Inter", sans-serif; -webkit-font-smoothing: antialiased; }
          a { color: #C96442; text-decoration: none; }
          a:hover { opacity: 0.85; }
          code { background: #F0EEE6; padding: 1px 6px; border-radius: 4px; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 0.92em; }
          @media (max-width: 820px) {
            h1 { font-size: 34px !important; line-height: 1.15 !important; }
            .hero-row { flex-direction: column !important; }
          }
        `}</style>
      </main>
    </>
  );
}

function TrustItem({ icon, text }) {
  return (
    <div style={s.trustItem}>
      <span style={s.trustIcon}>{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function Feature({ eyebrow, title, body }) {
  return (
    <div style={s.feature}>
      <div style={s.featureEyebrow}>{eyebrow}</div>
      <div style={s.featureTitle}>{title}</div>
      <div style={s.featureBody}>{body}</div>
    </div>
  );
}

const SURFACE = '#FFFFFF';
const BORDER  = '#EBE8DD';
const TEXT    = '#2A2925';
const MUTED   = '#7A7670';
const ACCENT  = '#C96442';

const s = {
  page:        { maxWidth: 1120, margin: '0 auto', padding: '20px 24px 60px' },
  nav:         { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40, padding: '6px 0' },
  brandRow:    { display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: TEXT },
  brandName:   { fontWeight: 600, fontSize: 15, letterSpacing: -0.2 },
  brandTag:    { color: MUTED, fontSize: 12, marginTop: 1 },
  navRight:    { display: 'flex', gap: 4, alignItems: 'center' },
  navLink:     { padding: '8px 14px', fontSize: 13, color: TEXT, fontWeight: 500, borderRadius: 999 },
  navCta:      { padding: '8px 16px', fontSize: 13, color: '#fff', fontWeight: 500, borderRadius: 999, background: ACCENT },

  hero:        { display: 'flex', gap: 40, alignItems: 'center', marginBottom: 60, flexWrap: 'wrap' },
  heroText:    { flex: '1 1 460px', minWidth: 280 },
  eyebrow:     { fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: ACCENT, fontWeight: 700, marginBottom: 20 },
  h1:          { fontSize: 'clamp(32px, 5vw, 52px)', lineHeight: 1.12, margin: '0 0 22px', letterSpacing: -1, fontWeight: 600 },
  accent:      { color: ACCENT },
  lede:        { fontSize: 17, color: '#4A4A47', lineHeight: 1.55, margin: '0 0 28px' },
  ctaRow:      { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 },
  primary:     { display: 'inline-block', padding: '13px 24px', background: ACCENT, color: '#fff', borderRadius: 10, fontSize: 15, fontWeight: 500 },
  secondary:   { display: 'inline-block', padding: '13px 24px', background: SURFACE, color: TEXT, borderRadius: 10, fontSize: 15, fontWeight: 500, border: `1px solid ${BORDER}` },
  trust:       { display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 8 },
  trustItem:   { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: MUTED },
  trustIcon:   { fontSize: 16 },

  coachCard:   { flex: '0 0 340px', background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 24, padding: 20, boxShadow: '0 2px 20px rgba(201,100,66,0.06)' },
  photoFrame:  { width: '100%', aspectRatio: '1/1', borderRadius: 18, overflow: 'hidden', background: '#F3F0E7', marginBottom: 18, position: 'relative' },
  photo:       { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  photoFallback: { position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 96, fontWeight: 600, color: '#fff', background: `linear-gradient(135deg, ${ACCENT} 0%, #D97757 50%, #E89A6F 100%)`, letterSpacing: -2 },
  coachMeta:   { padding: '0 4px' },
  coachLabel:  { fontSize: 11, textTransform: 'uppercase', letterSpacing: 2, color: ACCENT, fontWeight: 700, marginBottom: 6 },
  coachName:   { fontSize: 22, fontWeight: 700, letterSpacing: -0.4, color: TEXT },
  coachTitle:  { fontSize: 14, color: MUTED, marginTop: 2 },
  coachBio:    { fontSize: 13, color: '#4A4A47', lineHeight: 1.55, margin: '14px 0 14px' },
  coachLinks:  { display: 'flex', gap: 8, flexWrap: 'wrap' },
  coachLink:   { fontSize: 12, padding: '6px 12px', background: '#FFF8F0', border: `1px solid #F5E1D0`, borderRadius: 999, color: ACCENT, fontWeight: 500 },

  quoteBlock:  { background: `linear-gradient(135deg, #FFF8F0 0%, ${SURFACE} 100%)`, border: `1px solid ${BORDER}`, borderRadius: 24, padding: '48px 40px', marginBottom: 60, position: 'relative', textAlign: 'center' },
  quoteMark:   { fontSize: 120, color: ACCENT, opacity: 0.15, lineHeight: 1, position: 'absolute', top: 10, left: 30, fontFamily: 'Georgia, serif' },
  quote:       { fontSize: 'clamp(18px, 2.5vw, 24px)', lineHeight: 1.5, color: TEXT, maxWidth: 780, margin: '0 auto', fontWeight: 400, letterSpacing: -0.2, position: 'relative' },
  quoteAttr:   { fontSize: 13, color: MUTED, marginTop: 18, fontWeight: 500 },

  features:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 1, background: BORDER, border: `1px solid ${BORDER}`, borderRadius: 20, overflow: 'hidden', marginBottom: 60 },
  feature:     { padding: 32, background: SURFACE },
  featureEyebrow: { fontSize: 11, letterSpacing: 2, color: ACCENT, fontWeight: 700, marginBottom: 12 },
  featureTitle:{ fontSize: 20, fontWeight: 600, marginBottom: 10, letterSpacing: -0.3 },
  featureBody: { fontSize: 14, color: '#5A5A55', lineHeight: 1.6 },

  cta:         { textAlign: 'center', padding: '60px 24px', background: SURFACE, borderRadius: 24, border: `1px solid ${BORDER}`, marginBottom: 40 },
  ctaTitle:    { fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: 600, margin: '0 0 12px', letterSpacing: -0.6 },
  ctaLede:     { fontSize: 16, color: MUTED, margin: '0 0 28px' },

  footer:      { textAlign: 'center', color: MUTED, fontSize: 12, padding: '20px 0' },
};
