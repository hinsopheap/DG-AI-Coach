import AdminLayout from '../../components/AdminLayout';
import { requireAdmin } from '../../lib/auth';
import { listPaths, listTasksForPath } from '../../lib/firebase';

export async function getServerSideProps({ req, res }) {
  if (!requireAdmin(req, res)) return { props: {} };
  const paths = await listPaths();
  const sections = await Promise.all(paths.map(async p => {
    const tasks = await listTasksForPath(p.id);
    return {
      pathId:    p.id,
      pathTitle: p.title,
      tasks: tasks.map(t => ({
        id:              t.id,
        title:           t.title,
        task_type:       t.task_type || '',
        difficulty:      t.difficulty_level || '',
        sequence_order:  t.sequence_order || 0,
        status:          t.status || '',
      })),
    };
  }));
  return { props: { sections } };
}

export default function Tasks({ sections }) {
  return (
    <AdminLayout active="/admin/tasks">
      <h1 style={{ marginTop: 0 }}>Tasks</h1>
      {sections.length === 0 && (
        <div style={card}><em>No learning paths yet.</em></div>
      )}
      {sections.map(s => (
        <div key={s.pathId} style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, margin: '8px 0' }}>{s.pathTitle}</h2>
          <div style={card}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>#</th>
                  <th style={th}>Title</th>
                  <th style={th}>Type</th>
                  <th style={th}>Difficulty</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {s.tasks.map(t => (
                  <tr key={t.id}>
                    <td style={td}>{t.sequence_order}</td>
                    <td style={td}>{t.title}</td>
                    <td style={td}>{t.task_type}</td>
                    <td style={td}>{t.difficulty}</td>
                    <td style={td}>{t.status}</td>
                  </tr>
                ))}
                {s.tasks.length === 0 && (
                  <tr><td style={td} colSpan={5}><em>No tasks in this path yet.</em></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </AdminLayout>
  );
}

const card = { background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' };
const table = { width: '100%', borderCollapse: 'collapse', fontSize: 14 };
const th = { textAlign: 'left', padding: '8px 0', borderBottom: '1px solid #eee', color: '#666', fontWeight: 500 };
const td = { padding: '10px 0', borderBottom: '1px solid #f3f3f3', verticalAlign: 'top' };
