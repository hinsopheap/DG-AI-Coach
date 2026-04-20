import Head from 'next/head';
import Avatar from '../components/Avatar';

export default function Home() {
  return (
    <>
      <Head>
        <title>DG AI Coach</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#FAF9F5" />
      </Head>
      <main style={s.page}>
        <div style={s.brandRow}>
          <Avatar kind="coach" size={42} />
          <div>
            <div style={s.brandName}>DG AI Coach</div>
            <div style={s.brandTag}>by DG Academy · Cambodia AI Group</div>
          </div>
        </div>

        <h1 style={s.h1}>A senior AI coach in your pocket.</h1>
        <p style={s.lede}>
          Five focused minutes a day to apply frontier AI to your real work — over Telegram or right here in the browser. The same coach, the same memory, the same plan across both.
        </p>

        <div style={s.ctaRow}>
          <a href="/chat" style={s.primary}>Start a conversation →</a>
          <a href="https://t.me/dgaicoach_bot" target="_blank" rel="noreferrer" style={s.secondary}>Open in Telegram</a>
        </div>

        <div style={s.grid}>
          <Card title="Frontier-level expertise" body="Hands-on guidance with the latest Claude, GPT, and Gemini models — and how they actually fit into Cambodian business workflows." />
          <Card title="Practice, not theory" body={<>Direct links to <a href="https://dgchat.angkorgate.ai" target="_blank" rel="noreferrer">DG Chat</a> and <a href="https://aieureka.angkorgate.ai" target="_blank" rel="noreferrer">AI Eureka</a> for guided exercises that build muscle.</>} />
          <Card title="Orchestrated path" body="A daily 5-minute task tailored to your role and goal, scored automatically with concrete feedback and next steps." />
          <Card title="Two surfaces, one coach" body={<>Send <code>/web</code> in <a href="https://t.me/dgaicoach_bot" target="_blank" rel="noreferrer">@dgaicoach_bot</a> for a code that links your Telegram to the web chat.</>} />
        </div>

        <div style={s.footer}>
          <a href="/admin" style={s.adminLink}>Admin dashboard →</a>
        </div>

        <style jsx global>{`
          html, body { margin: 0; padding: 0; background: #FAF9F5; color: #2A2925; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Inter", sans-serif; -webkit-font-smoothing: antialiased; }
          a { color: #C96442; text-decoration: none; border-bottom: 1px solid rgba(201,100,66,0.3); }
          a:hover { border-bottom-color: #C96442; }
          code { background: #F0EEE6; padding: 1px 6px; border-radius: 4px; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
        `}</style>
      </main>
    </>
  );
}

function Card({ title, body }) {
  return (
    <div style={s.card}>
      <div style={s.cardTitle}>{title}</div>
      <div style={s.cardBody}>{body}</div>
    </div>
  );
}

const TEXT = '#2A2925';
const MUTED = '#7A7670';
const ACCENT = '#C96442';
const BORDER = '#EBE8DD';
const SURFACE = '#FFFFFF';

const s = {
  page:       { maxWidth: 760, margin: '0 auto', padding: '56px 24px 80px' },
  brandRow:   { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 },
  brandName:  { fontWeight: 600, fontSize: 17, letterSpacing: -0.2 },
  brandTag:   { color: MUTED, fontSize: 12, marginTop: 2 },
  h1:         { fontSize: 'clamp(28px, 5vw, 40px)', lineHeight: 1.15, margin: '0 0 16px', letterSpacing: -0.8, fontWeight: 600 },
  lede:       { fontSize: 17, color: '#5A5A55', lineHeight: 1.55, margin: '0 0 32px', maxWidth: 600 },
  ctaRow:     { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 56 },
  primary:    { display: 'inline-block', padding: '12px 22px', background: ACCENT, color: '#fff', borderRadius: 10, fontSize: 15, fontWeight: 500, border: 'none' },
  secondary:  { display: 'inline-block', padding: '12px 22px', background: SURFACE, color: TEXT, borderRadius: 10, fontSize: 15, fontWeight: 500, border: `1px solid ${BORDER}` },
  grid:       { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 48 },
  card:       { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 },
  cardTitle:  { fontSize: 15, fontWeight: 600, marginBottom: 8, color: TEXT },
  cardBody:   { fontSize: 14, color: '#5A5A55', lineHeight: 1.55 },
  footer:     { marginTop: 32, color: MUTED, fontSize: 13 },
  adminLink:  { color: MUTED, borderBottom: '1px solid transparent' },
};
