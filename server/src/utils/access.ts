import { query } from '../config/db';
import { forbidden, notFound } from './errors';

/** Ensures the given teacher owns the course; returns the course row. */
export async function assertTeacherOwnsCourse(courseId: number, teacherId: number) {
  const { rows } = await query('SELECT * FROM courses WHERE id = $1', [courseId]);
  if (!rows[0]) throw notFound('Курс не найден');
  if (rows[0].teacher_id !== teacherId) throw forbidden('Это не ваш курс');
  return rows[0];
}

/** Ensures the student belongs to the group of the given course. */
export async function assertStudentInCourse(courseId: number, studentId: number) {
  const { rows } = await query(
    `SELECT 1 FROM courses c
     JOIN student_profiles sp ON sp.group_id = c.group_id
     WHERE c.id = $1 AND sp.user_id = $2`,
    [courseId, studentId]
  );
  if (!rows[0]) throw forbidden('Нет доступа к этому курсу');
}
