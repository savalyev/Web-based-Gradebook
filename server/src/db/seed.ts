import bcrypt from 'bcryptjs';
import { pool, query, withTransaction } from '../config/db';

/**
 * Minimal seed: demo accounts + base structure (group, subjects, courses,
 * bell schedule, weekly timetable). Grades, lessons and submissions are
 * meant to be created through the UI.
 *
 * Demo credentials:
 *   teacher@demo  / teacher123
 *   student@demo  / student123   (+ ivanov / petrova / sidorov, same password)
 */
async function seed() {
  // Admin is created (idempotently) even on an already-seeded database.
  const adminHash = await bcrypt.hash('admin123', 10);
  await query(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, 'admin') ON CONFLICT (email) DO NOTHING`,
    ['admin@demo', adminHash, 'Администратор']
  );

  const existing = await query('SELECT 1 FROM users WHERE email = $1', ['teacher@demo']);
  if (existing.rowCount > 0) {
    // eslint-disable-next-line no-console
    console.log('Seed skipped — demo data already present (admin ensured).');
    await pool.end();
    return;
  }

  const teacherHash = await bcrypt.hash('teacher123', 10);
  const studentHash = await bcrypt.hash('student123', 10);

  await withTransaction(async (c) => {
    // Bell schedule — hardcoded lesson timings used for late detection.
    const bells: [number, string, string][] = [
      [1, '08:30', '10:00'],
      [2, '10:10', '11:40'],
      [3, '11:50', '13:20'],
      [4, '14:00', '15:30'],
      [5, '15:40', '17:10'],
      [6, '17:20', '18:50'],
    ];
    for (const [no, s, e] of bells) {
      await c.query(
        'INSERT INTO bell_schedule (period_no, starts_at, ends_at) VALUES ($1, $2, $3)',
        [no, s, e]
      );
    }

    // Teacher
    const teacher = await c.query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, 'teacher') RETURNING id`,
      ['teacher@demo', teacherHash, 'Преподаватель Иванова О. П.']
    );
    const teacherId = teacher.rows[0].id as number;

    // Group
    const group = await c.query('INSERT INTO groups (name) VALUES ($1) RETURNING id', ['ИС-21']);
    const groupId = group.rows[0].id as number;

    // Students (varied statuses to demonstrate row styling)
    const students: [string, string, string][] = [
      ['student@demo', 'Студент Демонстрационный', 'active'],
      ['ivanov@demo', 'Иванов Иван Иванович', 'active'],
      ['petrova@demo', 'Петрова Анна Сергеевна', 'new'],
      ['sidorov@demo', 'Сидоров Пётр Алексеевич', 'expelled'],
    ];
    for (const [email, name, status] of students) {
      const u = await c.query(
        `INSERT INTO users (email, password_hash, full_name, role)
         VALUES ($1, $2, $3, 'student') RETURNING id`,
        [email, studentHash, name]
      );
      await c.query(
        `INSERT INTO student_profiles (user_id, group_id, status) VALUES ($1, $2, $3)`,
        [u.rows[0].id, groupId, status]
      );
    }

    // Subjects + courses
    const subjectNames = ['Базы данных', 'Веб-программирование'];
    const courseIds: number[] = [];
    for (const name of subjectNames) {
      const s = await c.query('INSERT INTO subjects (name) VALUES ($1) RETURNING id', [name]);
      const course = await c.query(
        `INSERT INTO courses (subject_id, group_id, teacher_id) VALUES ($1, $2, $3) RETURNING id`,
        [s.rows[0].id, groupId, teacherId]
      );
      courseIds.push(course.rows[0].id);
    }

    // Weekly timetable: Базы данных Mon p.1 & Wed p.2; Веб Tue p.1 & Thu p.3
    const slots: [number, number, number, string][] = [
      [courseIds[0], 1, 1, 'А-301'],
      [courseIds[0], 3, 2, 'А-301'],
      [courseIds[1], 2, 1, 'Б-105'],
      [courseIds[1], 4, 3, 'Б-105'],
    ];
    for (const [courseId, weekday, period, room] of slots) {
      await c.query(
        `INSERT INTO timetable_slots (course_id, weekday, period_no, room) VALUES ($1, $2, $3, $4)`,
        [courseId, weekday, period, room]
      );
    }

    // One sample lab assignment so the lab screens have content to show.
    await c.query(
      `INSERT INTO assignments (course_id, type, title, description, materials, issued_date, deadline, max_grade, is_team)
       VALUES ($1, 'lab', $2, $3, $4, CURRENT_DATE, CURRENT_DATE + INTERVAL '14 days', 100, false)`,
      [
        courseIds[0],
        'Лабораторная работа №1. Проектирование схемы БД',
        'Спроектировать реляционную схему для предметной области и реализовать её в PostgreSQL.',
        'Документация PostgreSQL: https://www.postgresql.org/docs/',
      ]
    );
  });

  // eslint-disable-next-line no-console
  console.log('✓ Seed completed.');
  // eslint-disable-next-line no-console
  console.log('  Admin:   admin@demo / admin123');
  console.log('  Teacher: teacher@demo / teacher123');
  console.log('  Student: student@demo / student123');
  await pool.end();
}

seed().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', err);
  process.exit(1);
});
