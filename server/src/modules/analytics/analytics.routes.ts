import { Router } from 'express';
import { query } from '../../config/db';
import { asyncHandler } from '../../utils/async';
import { requireAuth } from '../../middleware/auth';
import { forbidden } from '../../utils/errors';

const router = Router();
router.use(requireAuth);

/** A teacher may view analytics for a group only if they teach that group. */
async function teacherTeachesGroup(teacherId: number, groupId: number): Promise<boolean> {
  const { rows } = await query(
    'SELECT 1 FROM courses WHERE teacher_id = $1 AND group_id = $2 LIMIT 1',
    [teacherId, groupId]
  );
  return rows.length > 0;
}

/**
 * GET /api/analytics/student/:id — performance timeline + per-subject averages.
 * Access: the student themselves, or a teacher who teaches their group.
 */
router.get(
  '/student/:id',
  asyncHandler(async (req, res) => {
    const studentId = Number(req.params.id);
    const u = req.user!;

    if (u.role === 'student') {
      if (u.id !== studentId) throw forbidden();
    } else {
      const g = await query('SELECT group_id FROM student_profiles WHERE user_id = $1', [studentId]);
      const groupId = g.rows[0]?.group_id;
      if (!groupId || !(await teacherTeachesGroup(u.id, groupId))) throw forbidden();
    }

    // Chronological grades from lessons and submissions.
    const timeline = await query(
      `SELECT d::date AS date, grade, source, subject FROM (
         SELECT l.date AS d, ge.grade, 'lesson' AS source, subj.name AS subject
         FROM grade_entries ge
         JOIN lessons l ON l.id = ge.lesson_id
         JOIN courses c ON c.id = l.course_id
         JOIN subjects subj ON subj.id = c.subject_id
         WHERE ge.student_id = $1 AND ge.grade IS NOT NULL
         UNION ALL
         SELECT s.graded_at::date AS d, s.grade, 'assignment' AS source, subj.name AS subject
         FROM submissions s
         JOIN assignments a ON a.id = s.assignment_id
         JOIN courses c ON c.id = a.course_id
         JOIN subjects subj ON subj.id = c.subject_id
         WHERE s.grade IS NOT NULL
           AND (s.student_id = $1 OR s.team_id IN (SELECT team_id FROM team_members WHERE student_id = $1))
       ) t
       ORDER BY date`,
      [studentId]
    );

    const bySubject = await query(
      `SELECT subject, ROUND(AVG(grade)::numeric, 1) AS avg_grade, COUNT(*) AS count
       FROM (
         SELECT subj.name AS subject, ge.grade
         FROM grade_entries ge
         JOIN lessons l ON l.id = ge.lesson_id
         JOIN courses c ON c.id = l.course_id
         JOIN subjects subj ON subj.id = c.subject_id
         WHERE ge.student_id = $1 AND ge.grade IS NOT NULL
       ) t
       GROUP BY subject ORDER BY subject`,
      [studentId]
    );

    const overall = timeline.rows.length
      ? Math.round((timeline.rows.reduce((s: number, r: any) => s + r.grade, 0) / timeline.rows.length) * 10) / 10
      : null;

    res.json({ timeline: timeline.rows, bySubject: bySubject.rows, overall });
  })
);

/**
 * GET /api/analytics/group/:id — group averages, per-student bars, distribution.
 * Access: a teacher who teaches the group.
 */
router.get(
  '/group/:id',
  asyncHandler(async (req, res) => {
    const groupId = Number(req.params.id);
    const u = req.user!;
    if (u.role !== 'teacher' || !(await teacherTeachesGroup(u.id, groupId))) throw forbidden();

    const perStudent = await query(
      `SELECT u.full_name AS student, ROUND(AVG(ge.grade)::numeric, 1) AS avg_grade
       FROM student_profiles sp
       JOIN users u ON u.id = sp.user_id
       LEFT JOIN grade_entries ge ON ge.student_id = u.id AND ge.grade IS NOT NULL
       WHERE sp.group_id = $1 AND sp.status <> 'expelled'
       GROUP BY u.id, u.full_name
       ORDER BY u.full_name`,
      [groupId]
    );

    const overTime = await query(
      `SELECT l.date::date AS date, ROUND(AVG(ge.grade)::numeric, 1) AS avg_grade
       FROM grade_entries ge
       JOIN lessons l ON l.id = ge.lesson_id
       JOIN courses c ON c.id = l.course_id
       JOIN student_profiles sp ON sp.user_id = ge.student_id AND sp.group_id = $1
       WHERE c.group_id = $1 AND ge.grade IS NOT NULL
       GROUP BY l.date ORDER BY l.date`,
      [groupId]
    );

    const distribution = await query(
      `SELECT bucket, COUNT(*)::int AS count FROM (
         SELECT CASE
           WHEN ge.grade >= 90 THEN '90-100'
           WHEN ge.grade >= 75 THEN '75-89'
           WHEN ge.grade >= 60 THEN '60-74'
           ELSE '<60' END AS bucket
         FROM grade_entries ge
         JOIN student_profiles sp ON sp.user_id = ge.student_id
         WHERE sp.group_id = $1 AND ge.grade IS NOT NULL
       ) t GROUP BY bucket`,
      [groupId]
    );

    res.json({ perStudent: perStudent.rows, overTime: overTime.rows, distribution: distribution.rows });
  })
);

export default router;
