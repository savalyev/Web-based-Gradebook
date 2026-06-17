import { Clock, MapPin } from 'lucide-react';
import { ScheduleSlot } from '../types';
import { WEEKDAYS, formatTime } from '../lib/format';
import { EmptyState } from './ui';

export default function WeeklySchedule({
  slots,
  showTeacher,
}: {
  slots: ScheduleSlot[];
  showTeacher?: boolean;
}) {
  if (!slots.length) {
    return <EmptyState title="Расписание пусто" hint="Занятия ещё не назначены" />;
  }

  const today = ((new Date().getDay() + 6) % 7) + 1; // Mon=1..Sun=7
  const days = [1, 2, 3, 4, 5, 6].filter((d) => slots.some((s) => s.weekday === d));

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {days.map((day) => {
        const daySlots = slots
          .filter((s) => s.weekday === day)
          .sort((a, b) => a.period_no - b.period_no);
        const isToday = day === today;
        return (
          <div key={day} className={`card overflow-hidden ${isToday ? 'ring-2 ring-brand-400' : ''}`}>
            <div
              className={`flex items-center justify-between px-4 py-3 ${
                isToday ? 'bg-brand-600 text-white' : 'bg-gray-50 text-gray-700'
              }`}
            >
              <span className="font-semibold">{WEEKDAYS[day]}</span>
              {isToday && <span className="badge bg-white/20 text-white">Сегодня</span>}
            </div>
            <div className="divide-y divide-gray-50">
              {daySlots.map((s) => (
                <div key={s.id} className="flex gap-3 px-4 py-3">
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
                      {s.room && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {s.room}
                        </span>
                      )}
                      <span>{showTeacher ? s.teacher_name : s.group_name}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
