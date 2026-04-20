import { useState } from 'react';
import Link from 'next/link';
import AdminLayout from '../../../components/AdminLayout';
import { requireAdmin } from '../../../lib/auth';
import { getUserById, listRecentMessages, getMemory } from '../../../lib/firebase';

export async function getServerSideProps({ req, res, params }) {
  if (!requireAdmin(req, res)) return { props: {} };
  const user = await getUserById(params.userId);
  if (!user) return { notFound: true };
  const [messages, memory] = await Promise.all([
    listRecentMessages(user.id, { limit: 200 }),
    getMemory(user.id),
  ]);

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
      memory: memory ? {
        personality:          memory.personality || {},
        interests:            memory.interests || [],
        strengths:            memory.strengths || [],
        growth_areas:         memory.growth_areas || [],
        preferences:          memory.preferences || {},
        open_threads:         memory.open_threads || [],
        key_facts:            memory.key_facts || [],
        last_consolidated_at: memory.last_consolidated_at || null,
        consolidated_message_count: memory.consolidated_message_count || 0,
      } : null,
    },
  };
}

export default function Conversation({ user, messages, memory: initialMemory }) {
  const [memory, setMemory] = useState(initialMemory);

  async function resetMemory() {
    if (!confirm('Erase all learned memory for this user? The coach will start from scratch.')) return;
    const res = await fetch('/api/admin/reset-memory', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ user_id: user.id }),
    });
    if (res.ok) setMemory(null);
  }

  return (
    <AdminLayout active="/admin/users">
      <div style={{ marginBottom: 16 }}>
        <Link href="/admin/users" style={{ color: '#666', textDecoration: 'none', fontSize: 13 }}>← Back to users</Link>
      </div>

      <h1 style={{ marginTop: 0 }}>{user.full_name || 'Unnamed learner'}</h1>
      <div style={{ color: '#666', marginBottom: 24, fontSize: 14 }}>
        {user.role} · status: {user.status} · streak: {user.streak_count}d · {user.paired ? 'Telegram + Web' : (user.telegram_id?.startsWith('web_') ? 'Web only' : 'Telegram only')}
      </div>

      <h2 style={{ fontSize: 16, margin: '0 0 10px' }}>🧠 Coach's memory</h2>
      <div style={{ ...card, marginBottom: 28 }}>
        {!memory && <em style={{ color: '#999' }}>No memory yet — the brain consolidates after ~6 user turns.</em>}
        {memory && (
          <div style={{ display: 'grid', gap: 14, fontSize: 14 }}>
            <Block title="Personality">
              {Object.entries(memory.personality).length === 0
                ? <em style={{ color: '#999' }}>not yet observed</em>
                : Object.entries(memory.personality).map(([k, v]) => (
                    <div key={k}><strong style={{ color: '#555' }}>{k.replace(/_/g, ' ')}:</strong> {String(v)}</div>
                  ))}
            </Block>
            <Block title="Strengths" items={memory.strengths} />
            <Block title="Growth edges" items={memory.growth_areas} />
            <Block title="Interests" items={memory.interests} />
            <Block title="Key facts" items={memory.key_facts} />
            <Block title="Open threads">
              {memory.open_threads.length === 0
                ? <em style={{ color: '#999' }}>none</em>
                : memory.open_threads.map((t, i) => (
                    <div key={i}>• {t.topic} {t.status && t.status !== 'open' && <span style={{ color: '#999' }}>[{t.status}]</span>}</div>
                  ))}
            </Block>
            <Block title="Preferences">
              {Object.entries(memory.preferences).length === 0
                ? <em style={{ color: '#999' }}>not yet observed</em>
                : Object.entries(memory.preferences).map(([k, v]) => (
                    <div key={k}><strong style={{ color: '#555' }}>{k.replace(/_/g, ' ')}:</strong> {String(v)}</div>
                  ))}
            </Block>
            <div style={{ color: '#888', fontSize: 12, borderTop: '1px solid #eee', paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
              <span>
                {memory.last_consolidated_at ? `Last consolidated ${new Date(memory.last_consolidated_at).toLocaleString()}` : 'Not yet consolidated'}
                {memory.consolidated_message_count ? ` · ${memory.consolidated_message_count} messages seen` : ''}
              </span>
              <button onClick={resetMemory} style={resetBtn}>Reset memory</button>
            </div>
          </div>
        )}
      </div>

      <h2 style={{ fontSize: 16, margin: '0 0 10px' }}>💬 Conversation</h2>
      <div style={card}>
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

function Block({ title, items, children }) {
  return (
    <div>
      <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: '#888', marginBottom: 4 }}>{title}</div>
      {children || (
        items?.length
          ? <ul style={{ margin: 0, paddingLeft: 18 }}>{items.map((it, i) => <li key={i}>{it}</li>)}</ul>
          : <em style={{ color: '#999' }}>not yet observed</em>
      )}
    </div>
  );
}

const card = { background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' };
const resetBtn = { background: 'transparent', color: '#c00', border: '1px solid #f0caca', padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer' };
