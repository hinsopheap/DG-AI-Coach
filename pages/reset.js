import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { AuthShell, s } from './signup';

export default function Reset() {
  const router = useRouter();
  const [step, setStep] = useState('request'); // 'request' | 'set'
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  // If a token is in the URL, jump straight to "set new password"
  if (router.isReady && router.query.token && step === 'request') {
    setStep('set');
  }

  async function requestReset(e) {
    e.preventDefault();
    setBusy(true); setErr(null); setMsg(null);
    try {
      const res = await fetch('/api/auth/request-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email }),
      });
      const j = await res.json();
      if (!j.ok) setErr(j.error || 'Reset failed');
      else setMsg(j.message || 'Check Telegram for a reset link.');
    } finally { setBusy(false); }
  }

  async function setNewPassword(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: router.query.token, password: form.password }),
      });
      const j = await res.json();
      if (!j.ok) { setErr(j.error || 'Reset failed'); return; }
      router.push('/chat');
    } finally { setBusy(false); }
  }

  if (step === 'set') {
    return (
      <AuthShell title="Set a new password" lede="Almost there. Pick a new password — you'll be signed in right after.">
        <Head><title>Reset password · DG AI Coach</title></Head>
        <form onSubmit={setNewPassword} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>New password</label>
            <input required type="password" minLength={8} autoFocus style={s.input}
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="At least 8 characters" />
          </div>
          {err && <div style={s.err}>{err}</div>}
          <button type="submit" disabled={busy} style={{ ...s.submit, opacity: busy ? 0.5 : 1 }}>
            {busy ? 'Updating…' : 'Save password →'}
          </button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Reset your password" lede="We'll send a reset link to your linked Telegram account.">
      <Head><title>Forgot password · DG AI Coach</title></Head>
      <form onSubmit={requestReset} style={s.form}>
        <div style={s.field}>
          <label style={s.label}>Email</label>
          <input required type="email" autoFocus style={s.input}
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        </div>
        {err && <div style={s.err}>{err}</div>}
        {msg && <div style={{ ...s.err, background: '#dcfce7', color: '#166534' }}>{msg}</div>}
        <button type="submit" disabled={busy} style={{ ...s.submit, opacity: busy ? 0.5 : 1 }}>
          {busy ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      <div style={s.footer}>
        <Link href="/signin" style={s.link}>← Back to sign in</Link>
      </div>
    </AuthShell>
  );
}
