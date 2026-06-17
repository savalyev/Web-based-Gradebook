import { AssignmentType, Attendance, LessonType, StudentStatus } from '../types';

export const WEEKDAYS = ['', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
export const WEEKDAYS_SHORT = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export const ASSIGNMENT_LABELS: Record<AssignmentType, string> = {
  lab: 'Лабораторная',
  theory: 'Теория',
  practice: 'Практика',
  control: 'Контрольная',
  test: 'Тест/опрос',
};

export const LESSON_LABELS: Record<LessonType, string> = {
  lecture: 'Лекция',
  lab: 'Лабораторная',
  practice: 'Практика',
  control: 'Контрольная',
  test: 'Тест/опрос',
};

export const ATTENDANCE_LABELS: Record<Attendance, string> = {
  present: 'Присутствовал',
  late: 'Опоздание',
  absent: 'Отсутствие',
};

export const STATUS_LABELS: Record<StudentStatus, string> = {
  active: 'Активный',
  new: 'Новый',
  expelled: 'Отчислен',
};

export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateShort(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

export function formatTime(t?: string | null): string {
  if (!t) return '';
  return t.slice(0, 5);
}

export function gradeColor(grade: number | null): string {
  if (grade == null) return 'text-gray-400';
  if (grade >= 90) return 'text-green-600';
  if (grade >= 75) return 'text-lime-600';
  if (grade >= 60) return 'text-amber-600';
  return 'text-brand-600';
}
