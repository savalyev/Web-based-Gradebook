import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ClipboardList,
  Plus,
  Trash2,
  Users,
  Upload,
  Pencil,
  CalendarClock,
} from 'lucide-react';
import { api, apiError } from '../../api/client';
import { Assignment } from '../../types';
import { PageHeader } from '../../components/Layout';
import { PageLoader, ErrorBanner, EmptyState, Modal, Spinner } from '../../components/ui';
import { ASSIGNMENT_LABELS, formatDate } from '../../lib/format';

export default function CourseProgram() {
  const { courseId } = useParams();
  const [course, setCourse] = useState<any>(null);
  const [items, setItems] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [teamFor, setTeamFor] = useState<Assignment | null>(null);

  const load = () => {
    Promise.all([api.get(`/courses/${courseId}`), api.get(`/assignments?courseId=${courseId}`)])
      .then(([c, a]) => {
        setCourse(c.data.course);
        setItems(a.data.assignments);
      })
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  };
  useEffect(load, [courseId]);

  const remove = async (id: number) => {
    if (!confirm('Удалить задание?')) return;
    await api.delete(`/assignments/${id}`);
    load();
  };

  if (loading) return <PageLoader />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div>
      <Link to="/courses" className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" /> К списку курсов
      </Link>
      <PageHeader
        title="Программа по предмету"
        subtitle={course ? `${course.subject} · ${course.group_name}` : ''}
        icon={<ClipboardList className="h-6 w-6" />}
        actions={
          <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
            <Plus className="h-4 w-4" /> Добавить задание
          </button>
        }
      />

      {items.length === 0 ? (
        <EmptyState title="Заданий пока нет" hint="Добавьте лабораторные, теорию, практику или контрольные" />
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <div key={a.id} className="card flex flex-wrap items-center gap-4 p-4">
              <span className="badge bg-brand-50 text-brand-700">{ASSIGNMENT_LABELS[a.type]}</span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{a.title}</p>
                <div className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-gray-400">
                  {a.deadline && (
                    <span className="flex items-center gap-1">
                      <CalendarClock className="h-3 w-3" /> Дедлайн {formatDate(a.deadline)}
                    </span>
                  )}
                  <span>Макс. балл: {a.max_grade}</span>
                  {a.is_team && <span className="text-brand-600">командная</span>}
                </div>
              </div>
              <div className="flex gap-1">
                {a.is_team && (
                  <button className="btn-ghost !px-2" title="Команды" onClick={() => setTeamFor(a)}>
                    <Users className="h-4 w-4" />
                  </button>
                )}
                <button className="btn-ghost !px-2" title="Редактировать" onClick={() => { setEditing(a); setShowForm(true); }}>
                  <Pencil className="h-4 w-4" />
                </button>
                <button className="btn-ghost !px-2 text-brand-600" title="Удалить" onClick={() => remove(a.id)}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <AssignmentForm
          courseId={Number(courseId)}
          editing={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
      {teamFor && (
        <TeamManager
          assignment={teamFor}
          courseId={Number(courseId)}
          onClose={() => setTeamFor(null)}
        />
      )}
    </div>
  );
}

const TYPES = Object.keys(ASSIGNMENT_LABELS) as Assignment['type'][];

function AssignmentForm({
  courseId,
  editing,
  onClose,
  onSaved,
}: {
  courseId: number;
  editing: Assignment | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<Assignment['type']>(editing?.type ?? 'lab');
  const [title, setTitle] = useState(editing?.title ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [materials, setMaterials] = useState(editing?.materials ?? '');
  const [issued, setIssued] = useState(editing?.issued_date?.slice(0, 10) ?? '');
  const [deadline, setDeadline] = useState(editing?.deadline?.slice(0, 10) ?? '');
  const [maxGrade, setMaxGrade] = useState(String(editing?.max_grade ?? 100));
  const [isTeam, setIsTeam] = useState(editing?.is_team ?? false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [tzFile, setTzFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    setErr('');
    if (!title.trim()) { setErr('Введите название'); return; }
    const mg = Number(maxGrade);
    if (!Number.isInteger(mg) || mg < 1 || mg > 100) { setErr('Макс. балл — целое число 1–100'); return; }
    setBusy(true);
    try {
      const payload = {
        type, title: title.trim(),
        description: description || null,
        materials: materials || null,
        issued_date: issued || null,
        deadline: deadline || null,
        max_grade: mg,
        is_team: isTeam,
      };
      let assignmentId = editing?.id;
      if (editing) {
        await api.put(`/assignments/${editing.id}`, payload);
      } else {
        const res = await api.post('/assignments', { courseId, ...payload });
        assignmentId = res.data.assignment.id;
      }
      // Upload ТЗ file if provided
      if (tzFile && assignmentId) {
        const form = new FormData();
        form.append('file', tzFile);
        const f = await api.post('/files', form);
        await api.post(`/assignments/${assignmentId}/files`, { fileId: f.data.file.id });
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
      title={editing ? 'Редактировать задание' : 'Новое задание'}
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Тип</label>
            <select className="input" value={type} onChange={(e) => setType(e.target.value as any)}>
              {TYPES.map((t) => <option key={t} value={t}>{ASSIGNMENT_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Макс. балл</label>
            <input type="number" min={1} max={100} className="input" value={maxGrade} onChange={(e) => setMaxGrade(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Название</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label">Описание</label>
          <textarea className="input min-h-[70px]" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="label">Теоретические материалы / комментарии</label>
          <textarea className="input min-h-[60px]" value={materials} onChange={(e) => setMaterials(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Дата выдачи</label>
            <input type="date" className="input" value={issued} onChange={(e) => setIssued(e.target.value)} />
          </div>
          <div>
            <label className="label">Дедлайн</label>
            <input type="date" className="input" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isTeam} onChange={(e) => setIsTeam(e.target.checked)} className="h-4 w-4 accent-brand-600" />
          Командная работа
        </label>
        <div>
          <label className="label">Прикрепить ТЗ (файл)</label>
          <div className="flex items-center gap-2">
            <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Выбрать файл
            </button>
            <span className="text-sm text-gray-500">{tzFile?.name ?? 'не выбран'}</span>
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => setTzFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>
      </div>
    </Modal>
  );
}

function TeamManager({
  assignment,
  courseId,
  onClose,
}: {
  assignment: Assignment;
  courseId: number;
  onClose: () => void;
}) {
  const [teams, setTeams] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [err, setErr] = useState('');

  const load = () => {
    Promise.all([
      api.get(`/assignments/${assignment.id}`),
      api.get(`/courses/${courseId}/students`),
    ]).then(([a, s]) => {
      setTeams(a.data.teams);
      setStudents(s.data.students.filter((st: any) => st.status !== 'expelled'));
    });
  };
  useEffect(load, [assignment.id]);

  const create = async () => {
    setErr('');
    if (!name.trim() || selected.length === 0) { setErr('Укажите название и хотя бы одного участника'); return; }
    try {
      await api.post(`/assignments/${assignment.id}/teams`, { name: name.trim(), memberIds: selected });
      setName(''); setSelected([]); load();
    } catch (e) { setErr(apiError(e)); }
  };

  const removeTeam = async (id: number) => {
    await api.delete(`/assignments/${assignment.id}/teams/${id}`);
    load();
  };

  return (
    <Modal open onClose={onClose} title={`Команды · ${assignment.title}`}>
      {err && <div className="mb-3"><ErrorBanner message={err} /></div>}

      <div className="mb-4 space-y-2">
        {teams.length === 0 && <p className="text-sm text-gray-400">Команд пока нет.</p>}
        {teams.map((t) => (
          <div key={t.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
            <div>
              <p className="text-sm font-medium">{t.name}</p>
              <p className="text-xs text-gray-400">{t.members.map((m: any) => m.full_name).join(', ')}</p>
            </div>
            <button className="text-gray-400 hover:text-brand-600" onClick={() => removeTeam(t.id)}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-gray-50 p-3">
        <label className="label">Новая команда</label>
        <input className="input mb-2" placeholder="Название команды" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="mb-2 max-h-40 space-y-1 overflow-y-auto">
          {students.map((s) => (
            <label key={s.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-white">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-600"
                checked={selected.includes(s.id)}
                onChange={(e) =>
                  setSelected((prev) => (e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id)))
                }
              />
              {s.full_name}
            </label>
          ))}
        </div>
        <button className="btn-primary w-full !py-2" onClick={create}>
          <Plus className="h-4 w-4" /> Создать команду
        </button>
      </div>
    </Modal>
  );
}
