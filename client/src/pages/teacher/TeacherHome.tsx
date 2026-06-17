import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { api, apiError } from '../../api/client';
import { ScheduleSlot } from '../../types';
import { PageHeader } from '../../components/Layout';
import { PageLoader, ErrorBanner } from '../../components/ui';
import WeeklySchedule from '../../components/WeeklySchedule';
import { useAuth } from '../../context/AuthContext';

export default function TeacherHome() {
  const { user } = useAuth();
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/schedule')
      .then((res) => setSlots(res.data.slots))
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title={`Здравствуйте, ${user?.fullName}!`}
        subtitle="Ваше расписание занятий на неделю"
        icon={<CalendarDays className="h-6 w-6" />}
      />
      {loading ? <PageLoader /> : error ? <ErrorBanner message={error} /> : (
        <WeeklySchedule slots={slots} />
      )}
    </div>
  );
}
