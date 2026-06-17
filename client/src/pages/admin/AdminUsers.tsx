import { useEffect, useState } from 'react';
import { Users, Plus, Trash2, Pencil } from 'lucide-react';
import { api, apiError } from '../../api/client';
import { PageHeader } from '../../components/Layout';
import { PageLoader, ErrorBanner, EmptyState, Modal, Spinner } from '../../components/ui';
import { STATUS_LABELS } from '../../lib/format';

interface AdminUser {
  id: number;
  email: string;
  full_name: string;
  role: 'student' | 'teacher' | 'admin';
  group_id: number | null;
  group_name: string | null;
  status: 'active' | 'new' | 'expelled' | null;
}
interface Group {
  id: number;
  name: string;
}

const ROLE_LABELS: Record<string, string> = {
  student: 'Студент',
  teacher: 'Преподаватель',
  admin: 'Администратор',
};

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/admin/users'), api.get('/admin/groups')])
      .then(([u, g]) => {
        setUsers(u.data.users);
        setGroups(g.data.groups);
      })
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const remove = async (id: number) => {
    if (!confirm('Удалить пользователя? Связанные данные тоже будут удалены.')) return;
    try {
      await api.delete(`/admin/users/${id}`);
      load();
    } catch (err) {
      setError(apiError(err));
    }
  };

  const shown = filter ? users.filter((u) => u.role === filter) : users;

  return (
    <div>
      <PageHeader
        title="Пользователи"
        subtitle="Преподаватели, студенты и администраторы"
        icon={<Users className="h-6 w-6" />}
        actions={
          <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus className="h-4 w-4" /> Добавить
          </button>
        }
      />
      {error && <div className="mb-3"><ErrorBanner message={error} /></div>}

      <div className="mb-4 flex gap-2">
        {['', 'teacher', 'student', 'admin'].map((r) => (
          <button
            key={r}
            onClick={() => setFilter(r)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              filter === r ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            {r === '' ? 'Все' : ROLE_LABELS[r]}
          </button>
        ))}
      </div>

      {loading ? (
        <PageLoader />
      ) : shown.length === 0 ? (
        <EmptyState title="Нет пользователей" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-3 font-semibold">Имя</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Роль</th>
                <th className="px-4 py-3 font-medium">Группа</th>
                <th className="px-4 py-3 font-medium">Статус</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {shown.map((u) => (
                <tr key={u.id} className="border-t border-gray-50 hover:bg-brand-50/30">
                  <td className="px-4 py-3 font-medium">{u.full_name}</td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="badge bg-gray-100 text-gray-600">{ROLE_LABELS[u.role]}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.group_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    {u.status ? (
                      <span
                        className={`badge ${
                          u.status === 'expelled'
                            ? 'bg-gray-200 text-gray-500'
                            : u.status === 'new'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-blue-50 text-blue-700'
                        }`}
                      >
                        {STATUS_LABELS[u.status]}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="btn-ghost !px-2" onClick={() => { setEditing(u); setShowForm(true); }}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button className="btn-ghost !px-2 text-brand-600" onClick={() => remove(u.id)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <UserForm
          editing={editing}
          groups={groups}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

function UserForm({
  editing,
  groups,
  onClose,
  onSaved,
}: {
  editing: AdminUser | null;
  groups: Group[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [email, setEmail] = useState(editing?.email ?? '');
  const [fullName, setFullName] = useState(editing?.full_name ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AdminUser['role']>(editing?.role ?? 'student');
  const [groupId, setGroupId] = useState<string>(editing?.group_id ? String(editing.group_id) : '');
  const [status, setStatus] = useState(editing?.status ?? 'new');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const isEdit = !!editing;

  const submit = async () => {
    setErr('');
    if (!isEdit && (!email.trim() || !password)) { setErr('Email и пароль обязательны'); return; }
    if (!fullName.trim()) { setErr('Введите имя'); return; }
    setBusy(true);
    try {
      if (isEdit) {
        const payload: any = { full_name: fullName.trim() };
        if (password) payload.password = password;
        if (editing!.role === 'student') {
          payload.group_id = groupId ? Number(groupId) : null;
          payload.status = status;
        }
        await api.patch(`/admin/users/${editing!.id}`, payload);
      } else {
        const payload: any = {
          email: email.trim(),
          password,
          full_name: fullName.trim(),
          role,
        };
        if (role === 'student') {
          payload.group_id = groupId ? Number(groupId) : null;
          payload.status = status;
        }
        await api.post('/admin/users', payload);
      }
      onSaved();
    } catch (e) {
      setErr(apiError(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? 'Редактировать пользователя' : 'Новый пользователь'}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy && <Spinner className="h-4 w-4" />} Сохранить
          </button>
        </>
      }
    >
      {err && <div className="mb-3"><ErrorBanner message={err} /></div>}
      <div className="space-y-3">
        <div>
          <label className="label">ФИО</label>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        {!isEdit && (
          <>
            <div>
              <label className="label">Email (логин)</label>
              <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label">Роль</label>
              <select className="input" value={role} onChange={(e) => setRole(e.target.value as any)}>
                <option value="student">Студент</option>
                <option value="teacher">Преподаватель</option>
                <option value="admin">Администратор</option>
              </select>
            </div>
          </>
        )}
        <div>
          <label className="label">{isEdit ? 'Новый пароль (необязательно)' : 'Пароль'}</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {((isEdit && editing!.role === 'student') || (!isEdit && role === 'student')) && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Группа</label>
              <select className="input" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                <option value="">— не выбрана —</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Статус</label>
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value as any)}>
                <option value="new">Новый</option>
                <option value="active">Активный</option>
                <option value="expelled">Отчислен</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
