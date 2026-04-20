import AdminLayout from '../../components/AdminLayout';
import { requireAdmin } from '../../lib/auth';
import { listPaths, listTasksForPath } from '../../lib/firebase';

export async function getServerSideProps({ req, res }) {
  if (!requireAdmin(req, res)) return { props: {} };
  const paths = await listPaths();
  const enriched = await Promise.all(
    paths.map(async p => {
      const tasks = await listTasksForPath(p.id);
      return {
        id:          p.id,
        title:       p.title,
        target_role: p.target_role || '',
        description: p.description || '',
        status:      p.status || 'draft',
        taskCount:   tasks.length,
      };
    }),
  );
  return { props: { paths: enriched } };
}

export default function Paths({ paths }) {
  return (
    <AdminLayout active="/admin/paths">
      <h1 style={{ marginTop: 0 }}>Learning paths</h1>
      <div style={card}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Title</th>
              <th style={th}>Target role</th>
              <th style={th}>Tasks</th>
              <th style={th}>Status</th>
              <th style={th}>Description</th>
            </tr>
          </thead>
          <tbody>
            {paths.map(p => (
              <tr key={p.id}>
                <td style={td}>{p.title}</td>
                <td style={td}>{p.target_role}</td>
                <td style={td}>{p.taskCount}</td>
                <td style={td}>{p.status}</td>
                <td style={{ ...td, color: '#666' }}>{p.description}</td>
              </tr>
            ))}
            {paths.length === 0 && (
              <tr><td style={td} colSpan={5}>
                <em>No paths yet. Run <code>npm run seed</code> to install sample paths.</em>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}

const card = { background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' };
const table = { width: '100%', borderCollapse: 'collapse', fontSize: 14 };
const th = { textAlign: 'left', padding: '8px 0', borderBottom: '1px solid #eee', color: '#666', fontWeight: 500 };
const td = { padding: '10px 0', borderBottom: '1px solid #f3f3f3', verticalAlign: 'top' };
