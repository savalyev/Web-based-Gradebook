import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FlaskConical, LineChart as LineIcon, TrendingUp } from 'lucide-react';
import { api, apiError } from '../../api/client';
import { Assignment, Attendance } from '../../types';
import { PageHeader } from '../../components/Layout';
import { PageLoader, ErrorBanner } from '../../components/ui';
import { TimelineChart } from '../../components/Charts';
import {
  ASSIGNMENT_LABELS,
  ATTENDANCE_LABELS,
  formatDate,
  gradeColor,
} from '../../lib/format';
import { useAuth } from '../../context/AuthContext';

interface LessonRow {
  lesson_id: number;
  date: string;
  type: string;
  topic: string | null;
  grade: number | null;
  attendance: Attendance;
  comment: string | null;
}
interface AssignmentRow extends Assignment {
  grade: number | null;
  status: string | null;
  submitted_at: string | null;
}

export default function StudentSubject() {
  const { courseId } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState<{
    course: any;
    lessons: LessonRow[];
    assignments: AssignmentRow[];
  } | null>(null);
  const [timeline, setTimeline] = useState<{ date: string; grade: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get(`/student/courses/${courseId}`),
      api.get(`/analytics/student/${user!.id}`),
    ])
      .then(([c, a]) => {
        setData(c.data);
        setTimeline(a.data.timeline.filter((t: any) => t.subject === c.data.course.subject));
      })
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  }, [courseId, user]);

  if (loading) return <PageLoader />;
  if (error) return <ErrorBanner message={error} />;
  if (!data) return null;

  const graded = data.lessons.filter((l) => l.grade != null);
  const avg =
    graded.length > 0
      ? Math.round((graded.reduce((s, l) => s + (l.grade ?? 0), 0) / graded.length) * 10) / 10
      : null;
  const absences = data.lessons.filter((l) => l.attendance === 'absent').length;
  const lates = data.lessons.filter((l) => l.attendance === 'late').length;

  // Group assignments by type
  const byType = data.assignments.reduce<Record<string, AssignmentRow[]>>((acc, a) => {
    (acc[a.type] ??= []).push(a);
    return acc;
  }, {});

  return (
    <div>
      <Link to="/journal" className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" /> К журналу
      </Link>
      <PageHeader
        title={data.course.subject}
        subtitle={`${data.course.group_name} · ${data.course.teacher_name}`}
        icon={<TrendingUp className="h-6 w-6" />}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Средний балл" value={avg ?? '—'} accent />
        <Stat label="Оценок" value={graded.length} />
        <Stat label="Опозданий" value={lates} />
        <Stat label="Пропусков" value={absences} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <LineIcon className="h-5 w-5 text-brand-600" /> Динамика успеваемости
          </h3>
          {timeline.length ? (
            <TimelineChart data={timeline} />
          ) : (
            <p className="py-12 text-center text-sm text-gray-400">Пока нет оценок для графика</p>
          )}
        </div>

        <div className="card p-5">
          <h3 className="mb-3 font-semibold">Оценки по занятиям</h3>
          <div className="max-h-[260px] space-y-1 overflow-y-auto">
            {data.lessons.length === 0 && (
              <p className="py-8 text-center text-sm text-gray-400">Занятий пока нет</p>
            )}
            {data.lessons.map((l) => (
              <div key={l.lesson_id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-gray-50">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{l.topic || 'Занятие'}</p>
                  <p className="text-xs text-gray-400">{formatDate(l.date)}</p>
                </div>
                <div className="text-right">
                  {l.grade != null ? (
                    <span className={`text-lg font-bold ${gradeColor(l.grade)}`}>{l.grade}</span>
                  ) : (
                    <span className="text-xs text-gray-400">{ATTENDANCE_LABELS[l.attendance]}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <h3 className="mb-3 mt-8 font-semibold">Работы по предмету</h3>
      <div className="space-y-5">
        {Object.keys(byType).length === 0 && (
          <p className="text-sm text-gray-400">Заданий пока нет.</p>
        )}
        {Object.entries(byType).map(([type, items]) => (
          <div key={type}>
            <p className="mb-2 text-sm font-medium text-gray-500">
              {ASSIGNMENT_LABELS[type as keyof typeof ASSIGNMENT_LABELS]}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((a) => {
                const inner = (
                  <div className="card flex h-full flex-col gap-2 p-4 transition-shadow hover:shadow-md">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium leading-snug">{a.title}</p>
                      {a.grade != null && (
                        <span className={`shrink-0 text-lg font-bold ${gradeColor(a.grade)}`}>{a.grade}</span>
                      )}
                    </div>
                    <div className="mt-auto flex items-center justify-between text-xs text-gray-400">
                      <span>{a.deadline ? `Дедлайн: ${formatDate(a.deadline)}` : ''}</span>
                      <span
                        className={`badge ${
                          a.status === 'reviewed'
                            ? 'bg-green-50 text-green-700'
                            : a.status === 'submitted'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {a.status === 'reviewed' ? 'Проверено' : a.status === 'submitted' ? 'Сдано' : 'Не сдано'}
                      </span>
                    </div>
                  </div>
                );
                return a.type === 'lab' ? (
                  <Link key={a.id} to={`/lab/${a.id}`} className="block">
                    <div className="relative">
                      {inner}
                      <FlaskConical className="absolute right-3 top-12 h-4 w-4 text-brand-300" />
                    </div>
                  </Link>
                ) : (
                  <div key={a.id}>{inner}</div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: boolean }) {
  return (
    <div className={`card p-4 ${accent ? 'border-brand-100 bg-brand-50/40' : ''}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? 'text-brand-600' : ''}`}>{value}</p>
    </div>
  );
}
