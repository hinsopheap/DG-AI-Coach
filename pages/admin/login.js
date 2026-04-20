import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) router.push('/admin');
    else setErr((await res.json()).error || 'Login failed');
  }

  return (
    <div style={styles.page}>
      <form onSubmit={submit} style={styles.card}>
        <h1 style={{ margin: '0 0 8px' }}>DG AI Coach</h1>
        <p style={{ margin: '0 0 24px', color: '#666' }}>Admin sign in</p>
        <label style={styles.label}>Email</label>
        <input style={styles.input} type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        <label style={styles.label}>Password</label>
        <input style={styles.input} type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        {err && <div style={styles.err}>{err}</div>}
        <button type="submit" style={styles.btn}>Sign in</button>
      </form>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f7f8', fontFamily: 'system-ui, -apple-system, sans-serif' },
  card: { background: '#fff', padding: 32, borderRadius: 12, width: 340, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  label: { display: 'block', marginTop: 12, fontSize: 13, color: '#555' },
  input: { width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, marginTop: 4, fontSize: 14, boxSizing: 'border-box' },
  btn: { width: '100%', padding: 12, marginTop: 24, border: 'none', borderRadius: 8, background: '#111', color: '#fff', fontSize: 14, cursor: 'pointer' },
  err: { marginTop: 16, padding: 10, background: '#fee', color: '#c00', borderRadius: 6, fontSize: 13 },
};
