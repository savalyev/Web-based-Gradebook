import { Router } from 'express';
import { query } from '../../config/db';
import { asyncHandler } from '../../utils/async';
import { requireAuth, requireRole } from '../../middleware/auth';
import { assertStudentInCourse } from '../../utils/access';

const router = Router();
router.use(requireAuth, requireRole('student'));

/**
 * GET /api/student/journal — full gradebook: every course of the student's
 * group with the student's grade/attendance per lesson.
 */
router.get(
  '/journal',
  asyncHandler(async (req, res) => {
    const studentId = req.user!.id;
    const { rows } = await query(
      `SELECT c.id AS course_id, subj.name AS subject,
              l.id AS lesson_id, l.date, l.type, l.topic,
              ge.grade, ge.attendance, ge.comment
       FROM courses c
       JOIN subjects subj ON subj.id = c.subject_id
       JOIN student_profiles sp ON sp.group_id = c.group_id AND sp.user_id = $1
       JOIN lessons l ON l.course_id = c.id
       LEFT JOIN grade_entries ge ON ge.lesson_id = l.id AND ge.student_id = $1
       ORDER BY subj.name, l.date`,
      [studentId]
    );

    // Group into courses
    const map = new Map<number, any>();
    for (const r of rows) {
      if (!map.has(r.course_id)) {
        map.set(r.course_id, { courseId: r.course_id, subject: r.subject, entries: [] });
      }
      map.get(r.course_id).entries.push({
        lessonId: r.lesson_id,
        date: r.date,
        type: r.type,
        topic: r.topic,
        grade: r.grade,
        attendance: r.attendance,
        comment: r.comment,
      });
    }
    res.json({ courses: [...map.values()] });
  })
);

/**
 * GET /api/student/courses/:id — performance for a single subject:
 * lesson grades + assignment results, broken down by work type.
 */
router.get(
  '/courses/:id',
  asyncHandler(async (req, res) => {
    const studentId = req.user!.id;
    const courseId = Number(req.params.id);
    await assertStudentInCourse(courseId, studentId);

    const course = await query(
      `SELECT c.id, subj.name AS subject, g.name AS group_name, u.full_name AS teacher_name
       FROM courses c
       JOIN subjects subj ON subj.id = c.subject_id
       JOIN groups g ON g.id = c.group_id
       JOIN users u ON u.id = c.teacher_id
       WHERE c.id = $1`,
      [courseId]
    );

    const lessons = await query(
      `SELECT l.id AS lesson_id, l.date, l.type, l.topic, ge.grade, ge.attendance, ge.comment
       FROM lessons l
       LEFT JOIN grade_entries ge ON ge.lesson_id = l.id AND ge.student_id = $1
       WHERE l.course_id = $2
       ORDER BY l.date`,
      [studentId, courseId]
    );

    const assignments = await query(
      `SELECT a.id, a.type, a.title, a.deadline, a.issued_date, a.max_grade, a.is_team,
              s.grade, s.status, s.submitted_at, s.comment
       FROM assignments a
       LEFT JOIN submissions s ON s.assignment_id = a.id
         AND (s.student_id = $1 OR s.team_id IN (
            SELECT tm.team_id FROM team_members tm WHERE tm.student_id = $1))
       WHERE a.course_id = $2
       ORDER BY a.issued_date NULLS LAST, a.id`,
      [studentId, courseId]
    );

    res.json({ course: course.rows[0], lessons: lessons.rows, assignments: assignments.rows });
  })
);

export default router;
