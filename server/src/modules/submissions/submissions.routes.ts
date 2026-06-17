import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../../config/db';
import { asyncHandler } from '../../utils/async';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { assertTeacherOwnsCourse, assertStudentInCourse } from '../../utils/access';
import { notFound } from '../../utils/errors';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/submissions?courseId= | ?assignmentId= — teacher review list.
 * Returns submissions with submitter name, assignment info, deadline and files.
 */
router.get(
  '/',
  requireRole('teacher'),
  asyncHandler(async (req, res) => {
    const courseId = req.query.courseId ? Number(req.query.courseId) : null;
    const assignmentId = req.query.assignmentId ? Number(req.query.assignmentId) : null;
    if (!courseId && !assignmentId) throw notFound('Укажите courseId или assignmentId');

    let resolvedCourse = courseId;
    if (!resolvedCourse && assignmentId) {
      const a = await query('SELECT course_id FROM assignments WHERE id = $1', [assignmentId]);
      if (!a.rows[0]) throw notFound('Задание не найдено');
      resolvedCourse = a.rows[0].course_id;
    }
    await assertTeacherOwnsCourse(resolvedCourse!, req.user!.id);

    const { rows } = await query(
      `SELECT s.id, s.assignment_id, s.link, s.submitted_at, s.grade, s.comment, s.status,
              s.graded_at,
              a.title AS assignment_title, a.type, a.deadline, a.max_grade, a.is_team,
              u.full_name AS student_name,
              t.name AS team_name,
              (s.submitted_at::date > a.deadline) AS is_late,
              COALESCE(json_agg(json_build_object('id', f.id, 'original_name', f.original_name))
                       FILTER (WHERE f.id IS NOT NULL), '[]') AS files
       FROM submissions s
       JOIN assignments a ON a.id = s.assignment_id
       LEFT JOIN users u ON u.id = s.student_id
       LEFT JOIN teams t ON t.id = s.team_id
       LEFT JOIN submission_files sf ON sf.submission_id = s.id
       LEFT JOIN files f ON f.id = sf.file_id
       WHERE a.course_id = $1 ${assignmentId ? 'AND a.id = $2' : ''}
       GROUP BY s.id, a.id, u.full_name, t.name
       ORDER BY s.submitted_at DESC`,
      assignmentId ? [resolvedCourse, assignmentId] : [resolvedCourse]
    );
    res.json({ submissions: rows });
  })
);

/** POST /api/submissions — student submits a solution (link and/or files). */
const createSchema = z.object({
  assignmentId: z.number().int().positive(),
  link: z.string().url('Некорректная ссылка').max(1000).optional().nullable(),
  fileIds: z.array(z.number().int().positive()).optional().default([]),
});

router.post(
  '/',
  requireRole('student'),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const studentId = req.user!.id;
    const { assignmentId, link, fileIds } = req.body as z.infer<typeof createSchema>;

    const a = await query('SELECT id, course_id, is_team FROM assignments WHERE id = $1', [assignmentId]);
    if (!a.rows[0]) throw notFound('Задание не найдено');
    await assertStudentInCourse(a.rows[0].course_id, studentId);

    // Resolve team if this is a team assignment and the student has one.
    let teamId: number | null = null;
    if (a.rows[0].is_team) {
      const t = await query(
        `SELECT tm.team_id FROM team_members tm
         JOIN teams t ON t.id = tm.team_id
         WHERE t.assignment_id = $1 AND tm.student_id = $2`,
        [assignmentId, studentId]
      );
      teamId = t.rows[0]?.team_id ?? null;
    }

    const submission = await withTransaction(async (c) => {
      const s = await c.query(
        `INSERT INTO submissions (assignment_id, student_id, team_id, link, status)
         VALUES ($1, $2, $3, $4, 'submitted') RETURNING *`,
        [assignmentId, teamId ? null : studentId, teamId, link ?? null]
      );
      for (const fid of fileIds) {
        await c.query(
          'INSERT INTO submission_files (submission_id, file_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [s.rows[0].id, fid]
        );
      }
      return s.rows[0];
    });
    res.status(201).json({ submission });
  })
);

/** PUT /api/submissions/:id/review — teacher grades and comments a submission. */
const reviewSchema = z.object({
  grade: z.number().int().min(1).max(100).nullable().optional(),
  comment: z.string().max(2000).optional().nullable(),
});

router.put(
  '/:id/review',
  requireRole('teacher'),
  validate(reviewSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const owner = await query(
      `SELECT a.course_id FROM submissions s
       JOIN assignments a ON a.id = s.assignment_id WHERE s.id = $1`,
      [id]
    );
    if (!owner.rows[0]) throw notFound('Сдача не найдена');
    await assertTeacherOwnsCourse(owner.rows[0].course_id, req.user!.id);

    const { grade, comment } = req.body as z.infer<typeof reviewSchema>;
    const { rows } = await query(
      `UPDATE submissions
       SET grade = $1, comment = $2, status = 'reviewed', graded_by = $3, graded_at = now()
       WHERE id = $4 RETURNING *`,
      [grade ?? null, comment ?? null, req.user!.id, id]
    );
    res.json({ submission: rows[0] });
  })
);

export default router;
