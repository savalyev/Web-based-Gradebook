import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FlaskConical, Download, ExternalLink, Users, User } from 'lucide-react';
import { api, apiError } from '../../api/client';
import { Submission } from '../../types';
import { PageHeader } from '../../components/Layout';
import { PageLoader, ErrorBanner, EmptyState, Modal, Spinner } from '../../components/ui';
import { formatDate, gradeColor } from '../../lib/format';

export default function LabReview() {
  const { courseId } = useParams();
  const [course, setCourse] = useState<any>(null);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewing, setReviewing] = useState<Submission | null>(null);

  const load = () => {
    Promise.all([api.get(`/courses/${courseId}`), api.get(`/submissions?courseId=${courseId}`)])
      .then(([c, s]) => {
        setCourse(c.data.course);
        setSubs(s.data.submissions);
      })
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  };
  useEffect(load, [courseId]);

  if (loading) return <PageLoader />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div>
      <Link to="/courses" className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" /> К списку курсов
      </Link>
      <PageHeader
        title="Сдача работ"
        subtitle={course ? `${course.subject} · ${course.group_name}` : ''}
        icon={<FlaskConical className="h-6 w-6" />}
      />

      {subs.length === 0 ? (
        <EmptyState title="Сданных работ нет" hint="Здесь появятся решения студентов" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-3 font-semibold">Студент / команда</th>
                <th className="px-4 py-3 font-medium">Работа</th>
                <th className="px-4 py-3 font-medium">Сдано</th>
                <th className="px-4 py-3 font-medium">Дедлайн</th>
                <th className="px-4 py-3 font-medium">Решение</th>
                <th className="px-4 py-3 font-medium">Оценка</th>
                <th className="px-4 py-3 font-medium">Статус</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id} className="border-t border-gray-50 hover:bg-brand-50/30">
                  <td className="px-4 py-3 font-medium">
                    <span className="flex items-center gap-2">
                      {s.team_name ? <Users className="h-4 w-4 text-brand-400" /> : <User className="h-4 w-4 text-gray-400" />}
                      {s.team_name ?? s.student_name}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.assignment_title}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(s.submitted_at)}</td>
                  <td className="px-4 py-3">
                    {s.is_late ? (
                      <span className="badge bg-brand-50 text-brand-700">просрочено</span>
                    ) : (
                      <span className="text-gray-500">{formatDate(s.deadline)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      {s.files?.map((f) => (
                        <a key={f.id} href={`/api/files/${f.id}`} className="flex items-center gap-1 text-brand-600 hover:underline">
                          <Download className="h-3.5 w-3.5" /> {f.original_name}
                        </a>
                      ))}
                      {s.link && (
                        <a href={s.link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-brand-600 hover:underline">
                          <ExternalLink className="h-3.5 w-3.5" /> ссылка
                        </a>
                      )}
                      {!s.files?.length && !s.link && <span className="text-gray-300">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {s.grade != null ? (
                      <span className={`font-bold ${gradeColor(s.grade)}`}>{s.grade}</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${s.status === 'reviewed' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                      {s.status === 'reviewed' ? 'Проверено' : 'Ожидает'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="btn-secondary !py-1.5 text-xs" onClick={() => setReviewing(s)}>
                      Проверить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reviewing && (
        <ReviewModal
          submission={reviewing}
          onClose={() => setReviewing(null)}
          onSaved={() => { setReviewing(null); load(); }}
        />
      )}
    </div>
  );
}

function ReviewModal({
  submission,
  onClose,
  onSaved,
}: {
  submission: Submission;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [grade, setGrade] = useState(submission.grade != null ? String(submission.grade) : '');
  const [comment, setComment] = useState(submission.comment ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const max = submission.max_grade ?? 100;

  const save = async () => {
    setErr('');
    let g: number | null = null;
    if (grade !== '') {
      g = Number(grade);
      if (!Number.isInteger(g) || g < 1 || g > max) { setErr(`Оценка — целое число 1–${max}`); return; }
    }
    setBusy(true);
    try {
      await api.put(`/submissions/${submission.id}/review`, { grade: g, comment: comment || null });
      onSaved();
    } catch (e) { setErr(apiError(e)); setBusy(false); }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Проверка · ${submission.team_name ?? submission.student_name}`}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Отмена</button>
          <button className="btn-primary" onClick={save} disabled={busy}>
            {busy && <Spinner className="h-4 w-4" />} Сохранить отметку
          </button>
        </>
      }
    >
      {err && <div className="mb-3"><ErrorBanner message={err} /></div>}
      <p className="mb-4 text-sm text-gray-500">{submission.assignment_title}</p>
      <div className="space-y-3">
        <div>
          <label className="label">Оценка (1–{max})</label>
          <input
            className="input"
            inputMode="numeric"
            value={grade}
            onChange={(e) => setGrade(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="Например, 85"
          />
        </div>
        <div>
          <label className="label">Комментарий</label>
          <textarea className="input min-h-[100px]" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Замечания по работе..." />
        </div>
      </div>
    </Modal>
  );
}
