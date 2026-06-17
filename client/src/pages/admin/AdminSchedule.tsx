import { useEffect, useState } from 'react';
import { CalendarDays, Plus, Trash2, Clock, MapPin } from 'lucide-react';
import { api, apiError } from '../../api/client';
import { PageHeader } from '../../components/Layout';
import { PageLoader, ErrorBanner, EmptyState, Modal, Spinner } from '../../components/ui';
import { WEEKDAYS, formatTime } from '../../lib/format';

interface Slot {
  id: number;
  course_id: number;
  weekday: number;
  period_no: number;
  room: string | null;
  starts_at: string;
  ends_at: string;
  subject: string;
  group_name: string;
  teacher_name: string;
}
interface CourseOpt {
  id: number;
  subject: string;
  group_name: string;
  teacher_name: string;
}
interface Bell {
  period_no: number;
  starts_at: string;
  ends_at: string;
}

export default function AdminSchedule() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [courses, setCourses] = useState<CourseOpt[]>([]);
  const [bells, setBells] = useState<Bell[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/admin/timetable'), api.get('/admin/courses'), api.get('/admin/bells')])
      .then(([s, c, b]) => {
        setSlots(s.data.slots);
        setCourses(c.data.courses);
        setBells(b.data.bells);
      })
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const remove = async (id: number) => {
    try {
      await api.delete(`/admin/timetable/${id}`);
      load();
    } catch (err) {
      setError(apiError(err));
    }
  };

  const days = [1, 2, 3, 4, 5, 6];

  return (
    <div>
      <PageHeader
        title="Расписание"
        subtitle="Еженедельные занятия (отображаются у студентов и преподавателей)"
        icon={<CalendarDays className="h-6 w-6" />}
        actions={
          <button className="btn-primary" onClick={() => setShowForm(true)} disabled={!courses.length}>
            <Plus className="h-4 w-4" /> Добавить занятие
          </button>
        }
      />
      {error && <div className="mb-3"><ErrorBanner message={error} /></div>}

      {loading ? (
        <PageLoader />
      ) : !courses.length ? (
        <EmptyState title="Сначала создайте курсы" hint="Расписание строится из курсов" />
      ) : slots.length === 0 ? (
        <EmptyState title="Расписание пусто" hint="Добавьте первое занятие" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {days
            .filter((d) => slots.some((s) => s.weekday === d))
            .map((day) => (
              <div key={day} className="card overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 font-semibold text-gray-700">{WEEKDAYS[day]}</div>
                <div className="divide-y divide-gray-50">
                  {slots
                    .filter((s) => s.weekday === day)
                    .sort((a, b) => a.period_no - b.period_no)
                    .map((s) => (
                      <div key={s.id} className="flex items-start gap-3 px-4 py-3">
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-semibold text-brand-600">{s.period_no} пара</span>
                          <span className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
                            <Clock className="h-3 w-3" />
                            {formatTime(s.starts_at)}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{s.subject}</p>
                          <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-gray-500">
                            <span>{s.group_name}</span>
                            {s.room && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> {s.room}
                              </span>
                            )}
                          </div>
                        </div>
                        <button className="text-gray-300 hover:text-brand-600" onClick={() => remove(s.id)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {showForm && (
        <SlotForm
          courses={courses}
          bells={bells}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}

function SlotForm({
  courses,
  bells,
  onClose,
  onSaved,
}: {
  courses: CourseOpt[];
  bells: Bell[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [courseId, setCourseId] = useState('');
  const [weekday, setWeekday] = useState('1');
  const [period, setPeriod] = useState(bells[0]?.period_no ? String(bells[0].period_no) : '1');
  const [room, setRoom] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    if (!courseId) { setErr('Выберите курс'); return; }
    setBusy(true);
    try {
      await api.post('/admin/timetable', {
        course_id: Number(courseId),
        weekday: Number(weekday),
        period_no: Number(period),
        room: room || null,
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
      title="Новое занятие в расписании"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy && <Spinner className="h-4 w-4" />} Добавить
          </button>
        </>
      }
    >
      {err && <div className="mb-3"><ErrorBanner message={err} /></div>}
      <div className="space-y-3">
        <div>
          <label className="label">Курс</label>
          <select className="input" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">— выберите —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.subject} · {c.group_name} ({c.teacher_name})
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">День недели</label>
            <select className="input" value={weekday} onChange={(e) => setWeekday(e.target.value)}>
              {[1, 2, 3, 4, 5, 6].map((d) => <option key={d} value={d}>{WEEKDAYS[d]}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Пара</label>
            <select className="input" value={period} onChange={(e) => setPeriod(e.target.value)}>
              {bells.map((b) => (
                <option key={b.period_no} value={b.period_no}>
                  {b.period_no} ({formatTime(b.starts_at)}–{formatTime(b.ends_at)})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Аудитория</label>
          <input className="input" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Напр., А-301" />
        </div>
      </div>
    </Modal>
  );
}
