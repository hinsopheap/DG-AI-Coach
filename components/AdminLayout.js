import Link from 'next/link';

const NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/paths', label: 'Learning paths' },
  { href: '/admin/tasks', label: 'Tasks' },
  { href: '/admin/activity', label: 'Activity' },
];

export default function AdminLayout({ children, active }) {
  return (
    <div style={s.app}>
      <aside style={s.side}>
        <div style={s.brand}>DG AI Coach</div>
        <nav>
          {NAV.map(n => (
            <Link key={n.href} href={n.href} style={{ ...s.link, ...(active === n.href ? s.linkActive : {}) }}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div style={s.spacer} />
        <a href="/api/admin/logout" style={{ ...s.link, color: '#999' }}>Sign out</a>
      </aside>
      <main style={s.main}>{children}</main>
    </div>
  );
}

const s = {
  app:        { display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', background: '#f7f7f8' },
  side:       { width: 220, background: '#111', color: '#fff', padding: 24, display: 'flex', flexDirection: 'column' },
  brand:      { fontSize: 18, fontWeight: 600, marginBottom: 32 },
  link:       { display: 'block', padding: '10px 12px', color: '#ccc', textDecoration: 'none', borderRadius: 6, fontSize: 14 },
  linkActive: { background: '#2a2a2a', color: '#fff' },
  spacer:     { flex: 1 },
  main:       { flex: 1, padding: '32px 40px' },
};
