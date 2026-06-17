import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ClipboardList, FlaskConical, Users, Table } from 'lucide-react';
import { api, apiError } from '../../api/client';
import { Course } from '../../types';
import { PageHeader } from '../../components/Layout';
import { PageLoader, ErrorBanner, EmptyState } from '../../components/ui';

export default function TeacherCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/courses')
      .then((res) => setCourses(res.data.courses))
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;
  if (error) return <ErrorBanner message={error} />;

  return (
    <div>
      <PageHeader
        title="Журнал"
        subtitle="Предметы и группы, где вы ведёте занятия"
        icon={<BookOpen className="h-6 w-6" />}
      />

      {courses.length === 0 ? (
        <EmptyState title="Нет курсов" hint="Вам ещё не назначены предметы" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {courses.map((c) => (
            <div key={c.id} className="card flex flex-col p-5">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold leading-tight">{c.subject}</h3>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
                    <Users className="h-4 w-4" /> {c.group_name} · {c.student_count} студ.
                  </p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <BookOpen className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-auto grid grid-cols-3 gap-2 pt-2">
                <Link to={`/courses/${c.id}/journal`} className="btn-secondary flex-col !py-3 text-xs">
                  <Table className="h-4 w-4" /> Журнал
                </Link>
                <Link to={`/courses/${c.id}/program`} className="btn-secondary flex-col !py-3 text-xs">
                  <ClipboardList className="h-4 w-4" /> Программа
                </Link>
                <Link to={`/courses/${c.id}/labs`} className="btn-secondary flex-col !py-3 text-xs">
                  <FlaskConical className="h-4 w-4" /> Сдачи
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
