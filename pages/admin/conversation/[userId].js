import Link from 'next/link';
import AdminLayout from '../../../components/AdminLayout';
import { requireAdmin } from '../../../lib/auth';
import { getUserById, listRecentMessages } from '../../../lib/firebase';

export async function getServerSideProps({ req, res, params }) {
  if (!requireAdmin(req, res)) return { props: {} };
  const user = await getUserById(params.userId);
  if (!user) return { notFound: true };
  const messages = await listRecentMessages(user.id, { limit: 200 });
  return {
    props: {
      user: {
        id:           user.id,
        full_name:    user.full_name || '',
        role:         user.role || '',
        status:       user.status || '',
        streak_count: user.streak_count || 0,
        telegram_id:  user.telegram_id || '',
        paired:       user.telegram_id && !user.telegram_id.startsWith('web_'),
      },
      messages: messages.map(m => ({
        role:       m.role,
        text:       m.text,
        surface:    m.surface || '',
        created_at: m.created_at?.toDate?.().toISOString() || null,
      })),
    },
  };
}

export default function Conversation({ user, messages }) {
  return (
    <AdminLayout active="/admin/users">
      <div style={{ marginBottom: 16 }}>
        <Link href="/admin/users" style={{ color: '#666', textDecoration: 'none', fontSize: 13 }}>← Back to users</Link>
      </div>

      <h1 style={{ marginTop: 0 }}>{user.full_name || 'Unnamed learner'}</h1>
      <div style={{ color: '#666', marginBottom: 24, fontSize: 14 }}>
        {user.role} · status: {user.status} · streak: {user.streak_count}d · {user.paired ? 'Telegram + Web' : (user.telegram_id?.startsWith('web_') ? 'Web only' : 'Telegram only')}
      </div>

      <div style={{ background: '#fff', borderRadius: 10, padding: 16, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
        {messages.length === 0 && <em style={{ color: '#999' }}>No messages yet.</em>}
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
            <div style={{
              maxWidth: '75%',
              padding: '8px 12px',
              borderRadius: 10,
              background: m.role === 'user' ? '#111' : '#f5f5f7',
              color: m.role === 'user' ? '#fff' : '#111',
              fontSize: 14,
              whiteSpace: 'pre-wrap',
              lineHeight: 1.45,
            }}>
              {m.text}
              <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4 }}>
                {m.surface}{m.created_at ? ' · ' + new Date(m.created_at).toLocaleString() : ''}
              </div>
            </div>
          </div>
        ))}
      </div>
    </AdminLayout>
  );
}
