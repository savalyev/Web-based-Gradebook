import { useEffect, useState } from 'react';
import { api, apiError } from '../../api/client';
import { Spinner, ErrorBanner } from '../../components/ui';
import { BarsChart, TimelineChart } from '../../components/Charts';

export default function GroupAnalytics({ groupId }: { groupId: number }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/analytics/group/${groupId}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(apiError(err)));
  }, [groupId]);

  if (error) return <ErrorBanner message={error} />;
  if (!data) return <div className="flex justify-center py-8"><Spinner className="h-6 w-6 text-brand-600" /></div>;

  const hasData =
    data.perStudent.some((d: any) => d.avg_grade != null) || data.overTime.length > 0;

  if (!hasData) {
    return <p className="py-8 text-center text-sm text-gray-400">Недостаточно оценок для построения графиков.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h4 className="mb-2 text-sm font-medium text-gray-600">Средний балл по студентам</h4>
        <BarsChart
          data={data.perStudent.map((d: any) => ({ ...d, avg_grade: Number(d.avg_grade) || 0 }))}
          dataKey="avg_grade"
          nameKey="student"
          height={240}
        />
      </div>
      {data.overTime.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-gray-600">Средний балл группы по датам</h4>
          <TimelineChart data={data.overTime.map((d: any) => ({ date: d.date, grade: Number(d.avg_grade) || 0 }))} />
        </div>
      )}
      {data.distribution.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-gray-600">Распределение оценок</h4>
          <BarsChart data={data.distribution} dataKey="count" nameKey="bucket" height={200} />
        </div>
      )}
    </div>
  );
}
