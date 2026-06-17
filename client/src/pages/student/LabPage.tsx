import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  Download,
  FileText,
  FlaskConical,
  MessageSquare,
  Paperclip,
  Upload,
  Users,
  CheckCircle2,
} from 'lucide-react';
import { api, apiError } from '../../api/client';
import { Assignment, FileMeta, Submission, TeamInfo } from '../../types';
import { PageHeader } from '../../components/Layout';
import { PageLoader, ErrorBanner, Spinner } from '../../components/ui';
import { formatDate, gradeColor } from '../../lib/format';

interface LabData {
  assignment: Assignment & { subject: string };
  files: FileMeta[];
  teams: TeamInfo[];
  submission: (Submission & { files: FileMeta[] }) | null;
  team: TeamInfo | null;
  teammates: { id: number; full_name: string }[];
}

export default function LabPage() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<LabData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [link, setLink] = useState('');
  const [pending, setPending] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    api
      .get(`/assignments/${assignmentId}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  };
  useEffect(load, [assignmentId]);

  const submit = async () => {
    setSubmitError('');
    if (pending.length === 0 && !link.trim()) {
      setSubmitError('Прикрепите файл или укажите ссылку на решение');
      return;
    }
    setSubmitting(true);
    try {
      const fileIds: number[] = [];
      for (const f of pending) {
        const form = new FormData();
        form.append('file', f);
        const res = await api.post('/files', form);
        fileIds.push(res.data.file.id);
      }
      await api.post('/submissions', {
        assignmentId: Number(assignmentId),
        link: link.trim() || null,
        fileIds,
      });
      setPending([]);
      setLink('');
      load();
    } catch (err) {
      setSubmitError(apiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PageLoader />;
  if (error) return <ErrorBanner message={error} />;
  if (!data) return null;

  const { assignment: a, files, submission, teammates } = data;
  const overdue = a.deadline ? new Date(a.deadline) < new Date() : false;

  return (
    <div>
      <button onClick={() => navigate(-1)} className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand-600">
        <ArrowLeft className="h-4 w-4" /> Назад
      </button>
      <PageHeader
        title={a.title}
        subtitle={a.subject}
        icon={<FlaskConical className="h-6 w-6" />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: details */}
        <div className="space-y-6 lg:col-span-2">
          {a.description && (
            <div className="card p-5">
              <h3 className="mb-2 font-semibold">Описание</h3>
              <p className="whitespace-pre-wrap text-sm text-gray-600">{a.description}</p>
            </div>
          )}

          {(files.length > 0 || a.materials) && (
            <div className="card p-5">
              <h3 className="mb-3 flex items-center gap-2 font-semibold">
                <FileText className="h-5 w-5 text-brand-600" /> Теоретические материалы и ТЗ
              </h3>
              {a.materials && <p className="mb-3 whitespace-pre-wrap text-sm text-gray-600">{a.materials}</p>}
              <div className="space-y-2">
                {files.map((f) => (
                  <a
                    key={f.id}
                    href={`/api/files/${f.id}`}
                    className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    <Download className="h-4 w-4 text-gray-400" />
                    {f.original_name}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Submission area */}
          <div className="card p-5">
            <h3 className="mb-3 flex items-center gap-2 font-semibold">
              <Upload className="h-5 w-5 text-brand-600" /> Ваше решение
            </h3>

            {submission && (
              <div className="mb-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Сдано {formatDate(submission.submitted_at)}
                </div>
                {submission.files?.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {submission.files.map((f) => (
                      <a key={f.id} href={`/api/files/${f.id}`} className="flex items-center gap-2 text-sm text-brand-600 hover:underline">
                        <Paperclip className="h-3.5 w-3.5" /> {f.original_name}
                      </a>
                    ))}
                  </div>
                )}
                {submission.link && (
                  <a href={submission.link} target="_blank" rel="noreferrer" className="mt-1 block text-sm text-brand-600 hover:underline">
                    {submission.link}
                  </a>
                )}
              </div>
            )}

            {submitError && <div className="mb-3"><ErrorBanner message={submitError} /></div>}

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                setPending((p) => [...p, ...Array.from(e.dataTransfer.files)]);
              }}
              onClick={() => fileInput.current?.click()}
              className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-gray-200 py-8 text-center text-sm text-gray-500 hover:border-brand-300 hover:bg-brand-50/30"
            >
              <Upload className="h-6 w-6 text-gray-400" />
              Перетащите файл сюда или нажмите для выбора
              <input
                ref={fileInput}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => setPending((p) => [...p, ...Array.from(e.target.files ?? [])])}
              />
            </div>

            {pending.length > 0 && (
              <ul className="mt-3 space-y-1">
                {pending.map((f, i) => (
                  <li key={i} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5 text-sm">
                    <span className="flex items-center gap-2"><Paperclip className="h-3.5 w-3.5 text-gray-400" />{f.name}</span>
                    <button onClick={() => setPending((p) => p.filter((_, j) => j !== i))} className="text-gray-400 hover:text-brand-600">✕</button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3">
              <label className="label">Или ссылка на решение (GitHub и т. п.)</label>
              <input className="input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://github.com/..." />
            </div>

            <button onClick={submit} disabled={submitting} className="btn-primary mt-4">
              {submitting && <Spinner className="h-4 w-4" />}
              {submission ? 'Пересдать работу' : 'Сдать работу'}
            </button>
          </div>
        </div>

        {/* Right: meta */}
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="mb-3 font-semibold">Информация</h3>
            <dl className="space-y-3 text-sm">
              <Meta icon={<CalendarClock className="h-4 w-4" />} label="Дата выдачи" value={formatDate(a.issued_date)} />
              <Meta
                icon={<CalendarClock className="h-4 w-4" />}
                label="Дедлайн"
                value={
                  <span className={overdue && !submission ? 'font-medium text-brand-600' : ''}>
                    {formatDate(a.deadline)}
                  </span>
                }
              />
              <Meta icon={<FlaskConical className="h-4 w-4" />} label="Макс. балл" value={a.max_grade} />
            </dl>
          </div>

          {submission?.status === 'reviewed' && (
            <div className="card p-5">
              <h3 className="mb-3 flex items-center gap-2 font-semibold">
                <MessageSquare className="h-5 w-5 text-brand-600" /> Отметка преподавателя
              </h3>
              {submission.grade != null && (
                <p className={`text-3xl font-bold ${gradeColor(submission.grade)}`}>
                  {submission.grade}
                  <span className="text-base font-normal text-gray-400"> / {a.max_grade}</span>
                </p>
              )}
              {submission.comment && (
                <p className="mt-3 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                  {submission.comment}
                </p>
              )}
            </div>
          )}

          {a.is_team && (
            <div className="card p-5">
              <h3 className="mb-3 flex items-center gap-2 font-semibold">
                <Users className="h-5 w-5 text-brand-600" /> Команда
              </h3>
              {teammates.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {teammates.map((m) => (
                    <li key={m.id} className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                        {m.full_name[0]}
                      </span>
                      {m.full_name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">Команда ещё не сформирована</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Meta({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="flex items-center gap-2 text-gray-500">{icon}{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
