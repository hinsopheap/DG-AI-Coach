import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Avatar from '../components/Avatar';

export default function SignUp() {
  const router = useRouter();
  const [form, setForm] = useState({ full_name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (!j.ok) { setErr(j.error || 'Sign up failed'); return; }
      router.push('/chat');
    } catch {
      setErr('Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Create your account" lede="Start coaching in under a minute. The coach remembers who you are between sessions.">
      <Head><title>Sign up · DG AI Coach</title></Head>
      <form onSubmit={submit} style={s.form}>
        <Field label="Your name">
          <input required autoFocus maxLength={80} style={s.input} value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="e.g. Dara Chen" />
        </Field>
        <Field label="Email">
          <input required type="email" style={s.input} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="you@company.com" />
        </Field>
        <Field label="Password" hint="8+ characters. No email verification for now — we'll add magic links soon.">
          <input required type="password" minLength={8} style={s.input} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="At least 8 characters" />
        </Field>
        {err && <div style={s.err}>{err}</div>}
        <button type="submit" disabled={busy} style={{ ...s.submit, opacity: busy ? 0.5 : 1 }}>
          {busy ? 'Creating…' : 'Create account →'}
        </button>
        <div style={{ fontSize: 11, color: '#9B9690', textAlign: 'center', lineHeight: 1.5 }}>
          By creating an account, you agree to our{' '}
          <Link href="/terms" style={{ color: '#9B9690', textDecoration: 'underline' }}>Terms</Link>
          {' '}and{' '}
          <Link href="/privacy" style={{ color: '#9B9690', textDecoration: 'underline' }}>Privacy</Link>.
        </div>
      </form>
      <div style={s.footer}>
        Already have an account? <Link href="/signin" style={s.link}>Sign in</Link>
      </div>
    </AuthShell>
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

export function AuthShell({ title, lede, children }) {
  return (
    <>
      <Head>
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
        <div style={s.card}>
          <h1 style={s.h1}>{title}</h1>
          {lede && <p style={s.lede}>{lede}</p>}
          {children}
        </div>
        <style jsx global>{`
          html, body { margin: 0; padding: 0; background: #FAF9F5; color: #2A2925; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Inter", sans-serif; -webkit-font-smoothing: antialiased; }
          a { color: #C96442; text-decoration: none; }
          button { transition: opacity 0.15s, background 0.15s, transform 0.05s; }
          button:active:not(:disabled) { transform: scale(0.98); }
          input:focus { outline: none; border-color: #C96442; }
        `}</style>
      </div>
    </>
  );
}

const SURFACE = '#FFFFFF';
const BORDER  = '#EBE8DD';
const TEXT    = '#2A2925';
const MUTED   = '#7A7670';
const ACCENT  = '#C96442';

export const s = {
  page:       { minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px' },
  brand:      { marginBottom: 32 },
  brandLink:  { display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: TEXT },
  brandName:  { fontWeight: 600, fontSize: 16, letterSpacing: -0.2 },
  card:       { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 36, width: '100%', maxWidth: 420, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' },
  h1:         { fontSize: 26, fontWeight: 600, margin: '0 0 10px', letterSpacing: -0.4 },
  lede:       { fontSize: 14, color: MUTED, margin: '0 0 28px', lineHeight: 1.5 },
  form:       { display: 'flex', flexDirection: 'column', gap: 16 },
  field:      { display: 'flex', flexDirection: 'column', gap: 6 },
  label:      { fontSize: 13, fontWeight: 500, color: '#5A5A55' },
  input:      { padding: '11px 14px', border: `1px solid ${BORDER}`, borderRadius: 10, fontSize: 15, background: '#FEFDFA', color: TEXT },
  hint:       { fontSize: 11, color: MUTED, marginTop: -2 },
  err:        { background: '#FEE2E2', color: '#991B1B', padding: '10px 14px', borderRadius: 8, fontSize: 13 },
  submit:     { background: ACCENT, color: '#fff', border: 'none', padding: '12px 20px', borderRadius: 10, fontSize: 14, fontWeight: 500, cursor: 'pointer', marginTop: 8 },
  footer:     { textAlign: 'center', fontSize: 13, color: MUTED, marginTop: 20 },
  link:       { color: ACCENT, fontWeight: 500 },
};
