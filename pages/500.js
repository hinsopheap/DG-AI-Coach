import Head from 'next/head';
import Link from 'next/link';
import Avatar from '../components/Avatar';

export default function ServerError() {
  return (
    <>
      <Head>
        <title>Something went wrong · DG AI Coach</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div style={s.page}>
        <Link href="/" style={s.brandLink}>
          <Avatar kind="coach" size={32} />
          <span style={s.brandName}>DG AI Coach</span>
        </Link>
        <div style={s.card}>
          <div style={s.code}>500</div>
          <h1 style={s.h1}>Something went sideways.</h1>
          <p style={s.lede}>Sorry — that one's on us. Refresh the page, and if it keeps happening, ping the admin.</p>
          <div style={s.row}>
            <Link href="/chat" style={s.primary}>Back to chat</Link>
            <Link href="/" style={s.secondary}>Home</Link>
          </div>
        </div>
        <style jsx global>{`
          html, body { margin: 0; padding: 0; background: #FAF9F5; color: #2A2925; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Inter", sans-serif; }
          a { text-decoration: none; }
        `}</style>
      </div>
    </>
  );
}

const s = {
  page:       { minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', gap: 32 },
  brandLink:  { display: 'flex', alignItems: 'center', gap: 10, color: '#2A2925' },
  brandName:  { fontWeight: 600, fontSize: 16, letterSpacing: -0.2 },
  card:       { background: '#FFFFFF', border: '1px solid #EBE8DD', borderRadius: 16, padding: 40, maxWidth: 420, width: '100%', textAlign: 'center' },
  code:       { fontSize: 64, fontWeight: 700, color: '#DC2626', letterSpacing: -2, lineHeight: 1 },
  h1:         { fontSize: 22, fontWeight: 600, margin: '20px 0 8px', letterSpacing: -0.4 },
  lede:       { color: '#7A7670', fontSize: 14, margin: '0 0 24px', lineHeight: 1.5 },
  row:        { display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' },
  primary:    { padding: '10px 18px', background: '#C96442', color: '#fff', borderRadius: 10, fontSize: 14, fontWeight: 500 },
  secondary:  { padding: '10px 18px', background: '#FFFFFF', color: '#2A2925', borderRadius: 10, fontSize: 14, fontWeight: 500, border: '1px solid #EBE8DD' },
};
