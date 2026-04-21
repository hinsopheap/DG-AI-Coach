// components/DashboardShell.js — shared top bar for /chat, /dashboard, /profile
// so they feel like one app.

import Link from 'next/link';
import Avatar from './Avatar';

export default function DashboardShell({ user, active, children, showLevel = true }) {
  const name = user?.full_name || '';
  const streak = user?.streak_count || 0;

  return (
    <div style={s.page}>
      <header style={s.header}>
        <Link href="/chat" style={s.brandRow}>
          <Avatar kind="coach" size={32} />
          <div>
            <div style={s.brand}>DG AI Coach</div>
            {user && (
              <div style={s.sub}>
                {name ? `${name.split(' ')[0]}` : 'Welcome'}
                {streak > 0 && <span style={s.streak}> · 🔥 {streak}d</span>}
                {showLevel && user?.xp_level && (
                  <span style={s.levelBadge}>{user.xp_level.level_name} · L{user.xp_level.level}</span>
                )}
              </div>
            )}
          </div>
        </Link>

        <nav style={s.nav}>
          <NavLink href="/chat" active={active === 'chat'}>Chat</NavLink>
          <NavLink href="/dashboard" active={active === 'dashboard'}>Dashboard</NavLink>
          <NavLink href="/profile" active={active === 'profile'}>Profile</NavLink>
          {user?.has_account && (
            <a href="/api/auth/signout" style={{ ...s.navLink, color: '#9B9690' }}>Sign out</a>
          )}
        </nav>
      </header>

      <main style={s.main}>{children}</main>

      <style jsx global>{`
        html, body { margin: 0; padding: 0; background: #FAF9F5; color: #2A2925; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Inter", sans-serif; -webkit-font-smoothing: antialiased; }
        a { color: #C96442; text-decoration: none; }
        a:hover { opacity: 0.85; }
        button { transition: opacity 0.15s, background 0.15s, transform 0.05s, color 0.15s, border-color 0.15s; }
        button:active:not(:disabled) { transform: scale(0.98); }
      `}</style>
    </div>
  );
}

function NavLink({ href, active, children }) {
  return (
    <Link href={href} style={{ ...s.navLink, ...(active ? s.navLinkActive : {}) }}>
      {children}
    </Link>
  );
}

const s = {
  page:        { minHeight: '100dvh', background: '#FAF9F5' },
  header:      { padding: '12px 20px', background: '#FAF9F5', borderBottom: '1px solid #EBE8DD', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 5, gap: 16 },
  brandRow:    { display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit' },
  brand:       { fontWeight: 600, fontSize: 15, letterSpacing: -0.2 },
  sub:         { color: '#7A7670', fontSize: 12, marginTop: 2, display: 'flex', gap: 6, alignItems: 'center' },
  streak:      { color: '#D97706', fontWeight: 600 },
  levelBadge:  { color: '#C96442', fontWeight: 600, marginLeft: 4 },
  nav:         { display: 'flex', gap: 4 },
  navLink:     { padding: '8px 14px', borderRadius: 999, fontSize: 13, fontWeight: 500, color: '#5A5A55', background: 'transparent', border: '1px solid transparent' },
  navLinkActive: { background: '#FFFFFF', border: '1px solid #EBE8DD', color: '#2A2925' },
  main:        { maxWidth: 960, margin: '0 auto', padding: '24px 20px 64px' },
};
