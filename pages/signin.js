import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { AuthShell, s } from './signup';

export default function SignIn() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (!j.ok) { setErr(j.error || 'Sign in failed'); return; }
      router.push('/chat');
    } catch {
      setErr('Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Welcome back" lede="Pick up where you left off. Your memory, XP, and streak are waiting.">
      <Head><title>Sign in · DG AI Coach</title></Head>
      <form onSubmit={submit} style={s.form}>
        <div style={s.field}>
          <label style={s.label}>Email</label>
          <input required type="email" autoFocus style={s.input} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        </div>
        <div style={s.field}>
          <label style={s.label}>Password</label>
          <input required type="password" style={s.input} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
        </div>
        {err && <div style={s.err}>{err}</div>}
        <button type="submit" disabled={busy} style={{ ...s.submit, opacity: busy ? 0.5 : 1 }}>
          {busy ? 'Signing in…' : 'Sign in →'}
        </button>
      </form>
      <div style={s.footer}>
        New here? <Link href="/signup" style={s.link}>Create an account</Link>
        {' · '}
        <Link href="/reset" style={s.link}>Forgot password?</Link>
      </div>
    </AuthShell>
  );
}
