import { useEffect, useState } from 'react';
import { BookMarked, Plus, Trash2 } from 'lucide-react';
import { api, apiError } from '../../api/client';
import { PageHeader } from '../../components/Layout';
import { PageLoader, ErrorBanner, EmptyState, Modal, Spinner } from '../../components/ui';

interface CourseRow {
  id: number;
  subject: string;
  group_name: string;
  teacher_name: string;
}
interface Opt { id: number; name: string }

export default function AdminCourses() {
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [subjects, setSubjects] = useState<Opt[]>([]);
  const [groups, setGroups] = useState<Opt[]>([]);
  const [teachers, setTeachers] = useState<{ id: number; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/admin/courses'),
      api.get('/admin/subjects'),
      api.get('/admin/groups'),
      api.get('/admin/users?role=teacher'),
    ])
      .then(([c, s, g, t]) => {
        setCourses(c.data.courses);
        setSubjects(s.data.subjects);
        setGroups(g.data.groups);
        setTeachers(t.data.users);
      })
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const remove = async (id: number) => {
    if (!confirm('Удалить курс? Уроки и оценки этого курса будут удалены.')) return;
    try {
      await api.delete(`/admin/courses/${id}`);
      load();
    } catch (err) {
      setError(apiError(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="Курсы"
        subtitle="Связка «предмет + группа + преподаватель»"
        icon={<BookMarked className="h-6 w-6" />}
        actions={
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" /> Добавить курс
          </button>
        }
      />
      {error && <div className="mb-3"><ErrorBanner message={error} /></div>}

      {loading ? (
        <PageLoader />
      ) : courses.length === 0 ? (
        <EmptyState title="Курсов нет" hint="Сначала добавьте предметы, группы и преподавателей" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-3 font-semibold">Предмет</th>
                <th className="px-4 py-3 font-medium">Группа</th>
                <th className="px-4 py-3 font-medium">Преподаватель</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.id} className="border-t border-gray-50 hover:bg-brand-50/30">
                  <td className="px-4 py-3 font-medium">{c.subject}</td>
                  <td className="px-4 py-3 text-gray-600">{c.group_name}</td>
                  <td className="px-4 py-3 text-gray-600">{c.teacher_name}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="btn-ghost !px-2 text-brand-600" onClick={() => remove(c.id)}>
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
        <CourseForm
          subjects={subjects}
          groups={groups}
          teachers={teachers}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

function CourseForm({
  subjects,
  groups,
  teachers,
  onClose,
  onSaved,
}: {
  subjects: Opt[];
  groups: Opt[];
  teachers: { id: number; full_name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [subjectId, setSubjectId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    if (!subjectId || !groupId || !teacherId) { setErr('Заполните все поля'); return; }
    setBusy(true);
    try {
      await api.post('/admin/courses', {
        subject_id: Number(subjectId),
        group_id: Number(groupId),
        teacher_id: Number(teacherId),
      });
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
      title="Новый курс"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy && <Spinner className="h-4 w-4" />} Создать
          </button>
        </>
      }
    >
      {err && <div className="mb-3"><ErrorBanner message={err} /></div>}
      <div className="space-y-3">
        <div>
          <label className="label">Предмет</label>
          <select className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">— выберите —</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Группа</label>
          <select className="input" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">— выберите —</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Преподаватель</label>
          <select className="input" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            <option value="">— выберите —</option>
            {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
          </select>
        </div>
      </div>
    </Modal>
  );
}
