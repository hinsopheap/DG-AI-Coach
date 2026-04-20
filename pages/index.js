import Head from 'next/head';
import Link from 'next/link';
import Avatar from '../components/Avatar';

export default function Home() {
  return (
    <>
      <Head>
        <title>DG AI Coach — practical AI coaching, 5 minutes a day</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#FAF9F5" />
        <meta property="og:title" content="DG AI Coach" />
        <meta property="og:description" content="A senior AI coach in your pocket. Five focused minutes a day on Telegram or web." />
      </Head>
      <main style={s.page}>
        <nav style={s.nav}>
          <div style={s.brandRow}>
            <Avatar kind="coach" size={36} />
            <div>
              <div style={s.brandName}>DG AI Coach</div>
              <div style={s.brandTag}>by DG Academy</div>
            </div>
          </div>
          <div style={s.navRight}>
            <Link href="/chat" style={s.navLink}>Open chat</Link>
            <a href="https://t.me/dgaicoach_bot" target="_blank" rel="noreferrer" style={s.navLink}>Telegram</a>
          </div>
        </nav>

        <section style={s.hero}>
          <div style={s.heroEyebrow}>Cambodia AI Group · DG Academy</div>
          <h1 style={s.h1}>A senior AI coach<br />in your pocket.</h1>
          <p style={s.lede}>
            Five focused minutes a day to apply frontier AI to your real work. The coach has memory, forms opinions, and drives you toward concrete practice — over Telegram or right here in the browser.
          </p>
          <div style={s.ctaRow}>
            <Link href="/chat" style={s.primary}>Start a conversation →</Link>
            <a href="https://t.me/dgaicoach_bot" target="_blank" rel="noreferrer" style={s.secondary}>Open in Telegram</a>
          </div>
          <div style={s.trustRow}>
            <Link href="/dashboard" style={s.trustLink}>📊 Your dashboard</Link>
            <Link href="/profile" style={s.trustLink}>👤 Profile</Link>
            <Link href="/admin" style={s.trustLink}>🔒 Admin</Link>
          </div>
        </section>

        <section style={s.features}>
          <Feature
            eyebrow="01"
            title="A brain that learns you"
            body="The coach remembers how you prompt, what you care about, and what you're working on. Every session builds on the last. Check what it's learned on your dashboard."
          />
          <Feature
            eyebrow="02"
            title="Opinionated, not hedgy"
            body="No three-option lists when you asked for an answer. The coach forms a point of view, states it, and moves you toward the next concrete action in five minutes or less."
          />
          <Feature
            eyebrow="03"
            title="Practice, not theory"
            body={<>Direct links to <a href="https://dgchat.angkorgate.ai" target="_blank" rel="noreferrer">DG Chat</a>, <a href="https://aieureka.angkorgate.ai" target="_blank" rel="noreferrer">AI Eureka</a>, and <a href="https://ai.angkorgate.ai" target="_blank" rel="noreferrer">the AI portal</a> — with specific prompts to paste, not generic tips.</>}
          />
          <Feature
            eyebrow="04"
            title="XP, levels, achievements"
            body="Earn XP for every submission, streak bonuses, and rare coach-awarded badges for sharp moments. Watch your level climb as the habit compounds."
          />
          <Feature
            eyebrow="05"
            title="Multimodal"
            body="Send a screenshot, a photo of your whiteboard, or a voice note from your keyboard. The coach sees and responds to images in both web and Telegram."
          />
          <Feature
            eyebrow="06"
            title="One coach, two surfaces"
            body={<>Send <code>/web</code> in the Telegram bot to get a code. Paste it in the chat header. Same memory, same progress, same XP across both.</>}
          />
        </section>

        <section style={s.cta}>
          <h2 style={s.ctaTitle}>Ready to start?</h2>
          <p style={s.ctaLede}>First task arrives right after onboarding. No email required on web.</p>
          <div style={s.ctaRow}>
            <Link href="/chat" style={s.primary}>Open web chat</Link>
            <a href="https://t.me/dgaicoach_bot" target="_blank" rel="noreferrer" style={s.secondary}>Open in Telegram</a>
          </div>
        </section>

        <footer style={s.footer}>
          <div>DG Academy · Cambodia AI Group · Phnom Penh</div>
          <div style={{ marginTop: 4, color: '#9B9690' }}>Built with Next.js, Firestore, Claude · <a href="https://github.com/hinsopheap/DG-AI-Coach" target="_blank" rel="noreferrer" style={{ color: '#9B9690', borderBottom: '1px solid rgba(0,0,0,0.1)' }}>Source on GitHub</a></div>
        </footer>

        <style jsx global>{`
          html, body { margin: 0; padding: 0; background: #FAF9F5; color: #2A2925; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Inter", sans-serif; -webkit-font-smoothing: antialiased; }
          a { color: #C96442; text-decoration: none; }
          a:hover { opacity: 0.85; }
          code { background: #F0EEE6; padding: 1px 6px; border-radius: 4px; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 0.92em; }
          @media (max-width: 600px) {
            h1 { font-size: 36px !important; }
          }
        `}</style>
      </main>
    </>
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
  page:        { maxWidth: 1000, margin: '0 auto', padding: '24px 24px 60px' },
  nav:         { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 80 },
  brandRow:    { display: 'flex', alignItems: 'center', gap: 10 },
  brandName:   { fontWeight: 600, fontSize: 15, letterSpacing: -0.2 },
  brandTag:    { color: MUTED, fontSize: 12, marginTop: 1 },
  navRight:    { display: 'flex', gap: 6 },
  navLink:     { padding: '8px 14px', fontSize: 13, color: TEXT, fontWeight: 500, borderRadius: 999, border: 'none' },
  hero:        { textAlign: 'left', maxWidth: 720, margin: '0 auto 80px', padding: '40px 0' },
  heroEyebrow: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 2, color: ACCENT, fontWeight: 600, marginBottom: 20 },
  h1:          { fontSize: 'clamp(36px, 6.5vw, 64px)', lineHeight: 1.05, margin: '0 0 24px', letterSpacing: -1.5, fontWeight: 600 },
  lede:        { fontSize: 20, color: '#4A4A47', lineHeight: 1.5, margin: '0 0 36px', maxWidth: 640 },
  ctaRow:      { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 },
  primary:     { display: 'inline-block', padding: '14px 26px', background: ACCENT, color: '#fff', borderRadius: 12, fontSize: 15, fontWeight: 500 },
  secondary:   { display: 'inline-block', padding: '14px 26px', background: SURFACE, color: TEXT, borderRadius: 12, fontSize: 15, fontWeight: 500, border: `1px solid ${BORDER}` },
  trustRow:    { display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 },
  trustLink:   { fontSize: 13, color: MUTED, borderBottom: 'none' },
  features:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 1, background: BORDER, border: `1px solid ${BORDER}`, borderRadius: 20, overflow: 'hidden', marginBottom: 80 },
  feature:     { padding: 32, background: SURFACE },
  featureEyebrow: { fontSize: 11, letterSpacing: 2, color: ACCENT, fontWeight: 700, marginBottom: 12 },
  featureTitle:{ fontSize: 20, fontWeight: 600, marginBottom: 10, letterSpacing: -0.3 },
  featureBody: { fontSize: 14, color: '#5A5A55', lineHeight: 1.6 },
  cta:         { textAlign: 'center', padding: '60px 20px', background: SURFACE, borderRadius: 20, border: `1px solid ${BORDER}`, marginBottom: 60 },
  ctaTitle:    { fontSize: 32, fontWeight: 600, margin: '0 0 12px', letterSpacing: -0.5 },
  ctaLede:     { fontSize: 16, color: MUTED, margin: '0 0 32px' },
  footer:      { textAlign: 'center', color: MUTED, fontSize: 12, padding: '20px 0' },
};
