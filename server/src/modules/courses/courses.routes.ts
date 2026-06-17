import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../config/db';
import { asyncHandler } from '../../utils/async';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { assertTeacherOwnsCourse } from '../../utils/access';
import { notFound } from '../../utils/errors';

const router = Router();
router.use(requireAuth, requireRole('teacher'));

/** GET /api/courses — all courses the teacher leads. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT c.id, subj.name AS subject, g.name AS group_name, g.id AS group_id,
              (SELECT COUNT(*) FROM student_profiles sp WHERE sp.group_id = c.group_id) AS student_count
       FROM courses c
       JOIN subjects subj ON subj.id = c.subject_id
       JOIN groups g ON g.id = c.group_id
       WHERE c.teacher_id = $1
       ORDER BY subj.name`,
      [req.user!.id]
    );
    res.json({ courses: rows });
  })
);

/** GET /api/courses/:id — course header + roster. */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const courseId = Number(req.params.id);
    await assertTeacherOwnsCourse(courseId, req.user!.id);
    const course = await query(
      `SELECT c.id, subj.name AS subject, g.name AS group_name, g.id AS group_id
       FROM courses c
       JOIN subjects subj ON subj.id = c.subject_id
       JOIN groups g ON g.id = c.group_id
       WHERE c.id = $1`,
      [courseId]
    );
    res.json({ course: course.rows[0] });
  })
);

/** GET /api/courses/:id/students — roster with status (for team setup, etc.). */
router.get(
  '/:id/students',
  asyncHandler(async (req, res) => {
    const courseId = Number(req.params.id);
    const course = await assertTeacherOwnsCourse(courseId, req.user!.id);
    const { rows } = await query(
      `SELECT u.id, u.full_name, u.email, sp.status, sp.enrolled_at
       FROM student_profiles sp
       JOIN users u ON u.id = sp.user_id
       WHERE sp.group_id = $1
       ORDER BY u.full_name`,
      [course.group_id]
    );
    res.json({ students: rows });
  })
);

/**
 * GET /api/courses/:id/journal — the teacher journal grid.
 * Returns students (with status), lessons (columns) and a flat list of entries.
 */
router.get(
  '/:id/journal',
  asyncHandler(async (req, res) => {
    const courseId = Number(req.params.id);
    const course = await assertTeacherOwnsCourse(courseId, req.user!.id);

    const students = await query(
      `SELECT u.id, u.full_name, sp.status, sp.enrolled_at
       FROM student_profiles sp
       JOIN users u ON u.id = sp.user_id
       WHERE sp.group_id = $1
       ORDER BY u.full_name`,
      [course.group_id]
    );

    const lessons = await query(
      `SELECT l.id, l.date, l.period_no, l.topic, l.type, b.starts_at, b.ends_at
       FROM lessons l
       LEFT JOIN bell_schedule b ON b.period_no = l.period_no
       WHERE l.course_id = $1
       ORDER BY l.date, l.period_no`,
      [courseId]
    );

    const entries = await query(
      `SELECT ge.lesson_id, ge.student_id, ge.grade, ge.attendance, ge.comment
       FROM grade_entries ge
       JOIN lessons l ON l.id = ge.lesson_id
       WHERE l.course_id = $1`,
      [courseId]
    );

    res.json({
      course: { id: course.id, group_id: course.group_id },
      students: students.rows,
      lessons: lessons.rows,
      entries: entries.rows,
    });
  })
);

const lessonSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате YYYY-MM-DD'),
  period_no: z.number().int().positive().nullable().optional(),
  topic: z.string().max(300).optional().nullable(),
  type: z.enum(['lecture', 'lab', 'practice', 'control', 'test']).default('lecture'),
});

/** POST /api/courses/:id/lessons — add a lesson/day to the journal. */
router.post(
  '/:id/lessons',
  validate(lessonSchema),
  asyncHandler(async (req, res) => {
    const courseId = Number(req.params.id);
    await assertTeacherOwnsCourse(courseId, req.user!.id);
    const { date, period_no, topic, type } = req.body as z.infer<typeof lessonSchema>;
    const { rows } = await query(
      `INSERT INTO lessons (course_id, date, period_no, topic, type)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [courseId, date, period_no ?? null, topic ?? null, type]
    );
    res.status(201).json({ lesson: rows[0] });
  })
);

/** DELETE /api/courses/:id/lessons/:lessonId */
router.delete(
  '/:id/lessons/:lessonId',
  asyncHandler(async (req, res) => {
    const courseId = Number(req.params.id);
    await assertTeacherOwnsCourse(courseId, req.user!.id);
    const result = await query('DELETE FROM lessons WHERE id = $1 AND course_id = $2', [
      Number(req.params.lessonId),
      courseId,
    ]);
    if (result.rowCount === 0) throw notFound('Урок не найден');
    res.json({ ok: true });
  })
);

export default router;
