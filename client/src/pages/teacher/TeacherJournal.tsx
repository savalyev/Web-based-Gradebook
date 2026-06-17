import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, BarChart3, Info, FileSpreadsheet, Printer } from 'lucide-react';
import { api, apiError } from '../../api/client';
import { GradeEntry, JournalLesson, JournalStudent } from '../../types';
import { PageHeader } from '../../components/Layout';
import { PageLoader, ErrorBanner, Modal } from '../../components/ui';
import { LESSON_LABELS, formatDateShort, gradeColor } from '../../lib/format';
import GroupAnalytics from './GroupAnalytics';

type Attn = 'present' | 'late' | 'absent';
const key = (l: number, s: number) => `${l}:${s}`;

export default function TeacherJournal() {
  const { courseId } = useParams();
  const [students, setStudents] = useState<JournalStudent[]>([]);
  const [lessons, setLessons] = useState<JournalLesson[]>([]);
  const [entries, setEntries] = useState<Map<string, GradeEntry>>(new Map());
  const [groupId, setGroupId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // hover cross-highlight
  const [hover, setHover] = useState<{ s: number | null; l: number | null }>({ s: null, l: null });
  // selected cell popover
  const [sel, setSel] = useState<{ l: number; s: number } | null>(null);
  const [draft, setDraft] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const popInput = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get(`/courses/${courseId}/journal`)
      .then((res) => {
        setStudents(res.data.students);
        setLessons(res.data.lessons);
        setGroupId(res.data.course.group_id);
        const m = new Map<string, GradeEntry>();
        for (const e of res.data.entries as GradeEntry[]) m.set(key(e.lesson_id, e.student_id), e);
        setEntries(m);
      })
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  }, [courseId]);
  useEffect(load, [load]);

  useEffect(() => {
    if (sel) {
      const e = entries.get(key(sel.l, sel.s));
      setDraft(e?.grade != null ? String(e.grade) : '');
      setTimeout(() => popInput.current?.focus(), 0);
    }
  }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (body: any) => {
    try {
      const res = await api.put('/grades', body);
      const e = res.data.entry as GradeEntry;
      setEntries((prev) => new Map(prev).set(key(e.lesson_id, e.student_id), e));
    } catch (err) {
      setError(apiError(err));
    }
  };

  const setGrade = (l: number, s: number, value: string) => {
    if (value === '') return;
    const grade = Number(value);
    if (!Number.isInteger(grade) || grade < 1 || grade > 100) {
      setError('Оценка должна быть целым числом от 1 до 100');
      return;
    }
    setError('');
    save({ lessonId: l, studentId: s, grade });
  };

  const setAttn = (l: number, s: number, attendance: Attn) =>
    save({ lessonId: l, studentId: s, attendance });

  if (loading) return <PageLoader />;
  if (error && !students.length) return <ErrorBanner message={error} />;

  return (
    <div>
      <Link to="/courses" className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" /> К списку курсов
      </Link>
      <PageHeader
        title="Журнал"
        subtitle="ЛКМ — оценка · средняя кнопка — опоздание · правая кнопка — отсутствие"
        actions={
          <div className="no-print flex flex-wrap gap-2">
            <a href={`/api/export/journal/${courseId}`} className="btn-secondary">
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </a>
            <button onClick={() => window.print()} className="btn-secondary">
              <Printer className="h-4 w-4" /> PDF
            </button>
            {groupId && (
              <button onClick={() => setShowStats(true)} className="btn-secondary">
                <BarChart3 className="h-4 w-4" /> Графики
              </button>
            )}
            <button onClick={() => setShowAdd(true)} className="btn-primary">
              <Plus className="h-4 w-4" /> Добавить день
            </button>
          </div>
        }
      />

      {error && <div className="mb-3"><ErrorBanner message={error} /></div>}

      {lessons.length === 0 ? (
        <div className="card p-10 text-center text-gray-500">
          <Info className="mx-auto mb-2 h-6 w-6 text-gray-300" />
          Уроков пока нет. Нажмите «Добавить день», чтобы начать вести журнал.
        </div>
      ) : (
        <div className="card overflow-auto">
          <table className="border-collapse text-sm" onMouseLeave={() => setHover({ s: null, l: null })}>
            <thead>
              <tr>
                <th className="sticky left-0 z-20 min-w-[220px] border-b border-r border-gray-100 bg-gray-50 px-4 py-2 text-left font-semibold">
                  Студент
                </th>
                {lessons.map((l) => (
                  <th
                    key={l.id}
                    className={`min-w-[52px] border-b border-gray-100 px-1 py-2 text-center text-xs font-medium ${
                      hover.l === l.id ? 'bg-brand-50' : 'bg-gray-50'
                    }`}
                    title={`${l.topic ?? ''} (${LESSON_LABELS[l.type]})`}
                  >
                    <div className="text-gray-700">{formatDateShort(l.date)}</div>
                    <div className="text-[10px] text-gray-400">{l.period_no ? `${l.period_no} п.` : ''}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((st) => {
                const expelled = st.status === 'expelled';
                const isNew = st.status === 'new';
                return (
                  <tr key={st.id} className={hover.s === st.id ? 'bg-brand-50/40' : ''}>
                    <td
                      className={`sticky left-0 z-10 border-b border-r border-gray-100 px-4 py-2 ${
                        hover.s === st.id ? 'bg-brand-50' : 'bg-white'
                      } ${expelled ? 'opacity-40 line-through' : ''}`}
                      onMouseEnter={() => setHover((h) => ({ ...h, s: st.id }))}
                    >
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{st.full_name}</span>
                        {isNew && <span className="badge bg-green-100 text-green-700">новый</span>}
                        {expelled && <span className="badge bg-gray-200 text-gray-500">отчислен</span>}
                      </div>
                    </td>
                    {lessons.map((l) => {
                      const e = entries.get(key(l.id, st.id));
                      const isSel = sel?.l === l.id && sel?.s === st.id;
                      const hl =
                        hover.l === l.id || hover.s === st.id ? 'cell-hl-col' : '';
                      return (
                        <td
                          key={l.id}
                          className={`journal-cell relative cursor-pointer border-b border-gray-50 text-center ${hl} ${
                            isSel ? 'cell-hl-cell' : ''
                          }`}
                          onMouseEnter={() => setHover({ s: st.id, l: l.id })}
                          onClick={() => !expelled && setSel({ l: l.id, s: st.id })}
                          onAuxClick={(ev) => {
                            if (ev.button === 1 && !expelled) {
                              ev.preventDefault();
                              setAttn(l.id, st.id, 'late');
                            }
                          }}
                          onContextMenu={(ev) => {
                            ev.preventDefault();
                            if (!expelled) setAttn(l.id, st.id, 'absent');
                          }}
                        >
                          <CellContent e={e} />
                          {isSel && (
                            <CellPopover
                              inputRef={popInput}
                              draft={draft}
                              setDraft={setDraft}
                              onGrade={() => {
                                setGrade(l.id, st.id, draft);
                                setSel(null);
                              }}
                              onAttn={(a) => {
                                setAttn(l.id, st.id, a);
                                setSel(null);
                              }}
                              onAuto={() => {
                                save({ lessonId: l.id, studentId: st.id, attendance: 'auto' });
                                setSel(null);
                              }}
                              onClose={() => setSel(null)}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
        <span><b className="text-brand-600">Н</b> — отсутствие</span>
        <span><b className="text-amber-500">О</b> — опоздание</span>
        <span className="rounded bg-green-100 px-1.5 text-green-700">новый</span>
        <span className="line-through opacity-50">отчислен</span>
      </div>

      {showAdd && (
        <AddLessonModal
          courseId={Number(courseId)}
          onClose={() => setShowAdd(false)}
          onAdded={() => {
            setShowAdd(false);
            load();
          }}
        />
      )}

      {showStats && groupId && (
        <Modal open onClose={() => setShowStats(false)} title="Успеваемость группы">
          <GroupAnalytics groupId={groupId} />
        </Modal>
      )}
    </div>
  );
}

function CellContent({ e }: { e?: GradeEntry }) {
  if (!e) return <span className="block px-1 py-2 text-gray-200">·</span>;
  if (e.grade != null)
    return <span className={`block px-1 py-2 font-semibold ${gradeColor(e.grade)}`}>{e.grade}</span>;
  if (e.attendance === 'absent')
    return <span className="block px-1 py-2 font-bold text-brand-600">Н</span>;
  if (e.attendance === 'late')
    return <span className="block px-1 py-2 font-bold text-amber-500">О</span>;
  return <span className="block px-1 py-2 text-gray-200">·</span>;
}

function CellPopover({
  inputRef,
  draft,
  setDraft,
  onGrade,
  onAttn,
  onAuto,
  onClose,
}: {
  inputRef: React.RefObject<HTMLInputElement>;
  draft: string;
  setDraft: (v: string) => void;
  onGrade: () => void;
  onAttn: (a: Attn) => void;
  onAuto: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div
        className="absolute left-1/2 top-full z-40 mt-1 w-44 -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-2 text-left shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="input mb-2 text-center"
          inputMode="numeric"
          placeholder="Оценка"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onGrade();
            if (e.key === 'Escape') onClose();
          }}
        />
        <button className="btn-primary mb-2 w-full !py-1.5 text-xs" onClick={onGrade}>
          Поставить оценку
        </button>
        <div className="grid grid-cols-3 gap-1">
          <button className="rounded bg-gray-100 py-1 text-xs hover:bg-gray-200" onClick={() => onAttn('present')}>Был</button>
          <button className="rounded bg-amber-100 py-1 text-xs text-amber-700 hover:bg-amber-200" onClick={() => onAttn('late')}>Опозд.</button>
          <button className="rounded bg-brand-100 py-1 text-xs text-brand-700 hover:bg-brand-200" onClick={() => onAttn('absent')}>Н/б</button>
        </div>
        <button className="mt-1 w-full rounded py-1 text-xs text-gray-500 hover:bg-gray-100" onClick={onAuto}>
          Авто (по времени)
        </button>
      </div>
    </>
  );
}

function AddLessonModal({
  courseId,
  onClose,
  onAdded,
}: {
  courseId: number;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [period, setPeriod] = useState('1');
  const [topic, setTopic] = useState('');
  const [type, setType] = useState('lecture');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    setBusy(true);
    try {
      await api.post(`/courses/${courseId}/lessons`, {
        date,
        period_no: period ? Number(period) : null,
        topic: topic || null,
        type,
      });
      onAdded();
    } catch (e) {
      setErr(apiError(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Добавить день в журнал"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn-primary" onClick={submit} disabled={busy}>Добавить</button>
        </>
      }
    >
      {err && <div className="mb-3"><ErrorBanner message={err} /></div>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Дата</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Пара №</label>
          <input type="number" min={1} max={6} className="input" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </div>
      </div>
      <div className="mt-3">
        <label className="label">Тип занятия</label>
        <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
          {Object.entries(LESSON_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>
      <div className="mt-3">
        <label className="label">Тема (необязательно)</label>
        <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Тема занятия" />
      </div>
    </Modal>
  );
}
