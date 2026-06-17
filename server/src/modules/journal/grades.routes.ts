import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../config/db';
import { asyncHandler } from '../../utils/async';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { assertTeacherOwnsCourse } from '../../utils/access';
import { notFound, forbidden } from '../../utils/errors';
import { detectAttendance } from '../../utils/timing';
import { notify } from '../../utils/notify';

const router = Router();
router.use(requireAuth, requireRole('teacher'));

const gradeSchema = z.object({
  lessonId: z.number().int().positive(),
  studentId: z.number().int().positive(),
  // grade: integer only (validation), nullable to clear it
  grade: z.number().int().min(1).max(100).nullable().optional(),
  // 'auto' lets the server decide based on the bell schedule and current time
  attendance: z.enum(['present', 'late', 'absent', 'auto']).optional(),
  comment: z.string().max(1000).nullable().optional(),
});

/**
 * PUT /api/grades — upsert a grade / attendance cell.
 * Server-side validation: grade must be an integer in range.
 */
router.put(
  '/',
  validate(gradeSchema),
  asyncHandler(async (req, res) => {
    const { lessonId, studentId, grade, comment } = req.body as z.infer<typeof gradeSchema>;
    let { attendance } = req.body as z.infer<typeof gradeSchema>;

    // Verify the lesson belongs to a course owned by this teacher.
    const lesson = await query(
      `SELECT l.id, l.course_id, b.starts_at, b.ends_at
       FROM lessons l LEFT JOIN bell_schedule b ON b.period_no = l.period_no
       WHERE l.id = $1`,
      [lessonId]
    );
    if (!lesson.rows[0]) throw notFound('Урок не найден');
    await assertTeacherOwnsCourse(lesson.rows[0].course_id, req.user!.id);

    // Verify the student belongs to that course's group.
    const inGroup = await query(
      `SELECT 1 FROM student_profiles sp
       JOIN courses c ON c.group_id = sp.group_id
       WHERE c.id = $1 AND sp.user_id = $2`,
      [lesson.rows[0].course_id, studentId]
    );
    if (!inGroup.rows[0]) throw forbidden('Студент не из этой группы');

    // Automatic late detection by lesson timing.
    if (attendance === 'auto') {
      const { starts_at, ends_at } = lesson.rows[0];
      attendance = starts_at && ends_at ? detectAttendance(starts_at, ends_at) : 'present';
    }

    const { rows } = await query(
      `INSERT INTO grade_entries (lesson_id, student_id, grade, attendance, comment, updated_at)
       VALUES ($1, $2, $3, COALESCE($4, 'present'), $5, now())
       ON CONFLICT (lesson_id, student_id) DO UPDATE SET
         grade = CASE WHEN $6 THEN EXCLUDED.grade ELSE grade_entries.grade END,
         attendance = COALESCE($4, grade_entries.attendance),
         comment = COALESCE($5, grade_entries.comment),
         updated_at = now()
       RETURNING *`,
      [
        lessonId,
        studentId,
        grade ?? null,
        attendance ?? null,
        comment ?? null,
        grade !== undefined, // only overwrite grade when the field was provided
      ]
    );

    // Notify the student when an actual grade is set.
    if (grade != null) {
      const subj = await query(
        `SELECT subj.name FROM courses c JOIN subjects subj ON subj.id = c.subject_id WHERE c.id = $1`,
        [lesson.rows[0].course_id]
      );
      await notify({
        userId: studentId,
        type: 'grade',
        title: 'Новая оценка',
        body: `${subj.rows[0]?.name ?? 'Предмет'}: ${grade}`,
        link: `/subject/${lesson.rows[0].course_id}`,
        refId: lessonId,
      });
    }

    res.json({ entry: rows[0] });
  })
);

export default router;
