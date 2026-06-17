import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight, FileSpreadsheet, Printer } from 'lucide-react';
import { api, apiError } from '../../api/client';
import { Attendance } from '../../types';
import { PageHeader } from '../../components/Layout';
import { PageLoader, ErrorBanner, EmptyState } from '../../components/ui';
import { formatDateShort, gradeColor } from '../../lib/format';

interface Entry {
  lessonId: number;
  date: string;
  grade: number | null;
  attendance: Attendance;
  comment: string | null;
}
interface CourseJournal {
  courseId: number;
  subject: string;
  entries: Entry[];
}

function AttendanceMark({ a }: { a: Attendance }) {
  if (a === 'absent') return <span className="font-bold text-brand-600" title="Отсутствие">Н</span>;
  if (a === 'late') return <span className="font-bold text-amber-500" title="Опоздание">О</span>;
  return <span className="text-gray-300">·</span>;
}

export default function StudentJournal() {
  const [courses, setCourses] = useState<CourseJournal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/student/journal')
      .then((res) => setCourses(res.data.courses))
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;
  if (error) return <ErrorBanner message={error} />;

  // Union of all dates (columns), sorted ascending.
  const allDates = Array.from(
    new Set(courses.flatMap((c) => c.entries.map((e) => e.date)))
  ).sort();

  return (
    <div>
      <PageHeader
        title="Электронный журнал"
        subtitle="Оценки и посещаемость по всем предметам"
        icon={<BookOpen className="h-6 w-6" />}
        actions={
          <div className="no-print flex gap-2">
            <a href="/api/export/student-journal" className="btn-secondary">
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </a>
            <button onClick={() => window.print()} className="btn-secondary">
              <Printer className="h-4 w-4" /> PDF
            </button>
          </div>
        }
      />

      {courses.length === 0 ? (
        <EmptyState title="Нет предметов" hint="Курсы ещё не назначены вашей группе" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left font-semibold">
                  Предмет
                </th>
                {allDates.map((d) => (
                  <th key={d} className="whitespace-nowrap px-3 py-3 text-center font-medium">
                    {formatDateShort(d)}
                  </th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => {
                const byDate = new Map(c.entries.map((e) => [e.date, e]));
                return (
                  <tr key={c.courseId} className="border-t border-gray-50 hover:bg-brand-50/40">
                    <td className="sticky left-0 z-10 bg-white px-4 py-3 font-medium">
                      <Link to={`/subject/${c.courseId}`} className="hover:text-brand-600">
                        {c.subject}
                      </Link>
                    </td>
                    {allDates.map((d) => {
                      const e = byDate.get(d);
                      return (
                        <td key={d} className="px-3 py-3 text-center">
                          {!e ? (
                            <span className="text-gray-200">—</span>
                          ) : e.grade != null ? (
                            <span className={`font-semibold ${gradeColor(e.grade)}`}>{e.grade}</span>
                          ) : (
                            <AttendanceMark a={e.attendance} />
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/subject/${c.courseId}`}
                        className="inline-flex items-center text-brand-600 hover:text-brand-700"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </Link>
                    </td>
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
        <span className="font-semibold text-green-600">90+ отлично</span>
      </div>
    </div>
  );
}
