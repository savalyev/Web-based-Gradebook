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

async function getAssignmentCourse(assignmentId: number): Promise<number> {
  const { rows } = await query('SELECT course_id FROM assignments WHERE id = $1', [assignmentId]);
  if (!rows[0]) throw notFound('Задание не найдено');
  return rows[0].course_id;
}

/** GET /api/assignments?courseId= — list assignments of a course. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const courseId = Number(req.query.courseId);
    if (!courseId) throw notFound('courseId обязателен');
    if (req.user!.role === 'teacher') await assertTeacherOwnsCourse(courseId, req.user!.id);
    else await assertStudentInCourse(courseId, req.user!.id);

    const { rows } = await query(
      `SELECT id, type, title, description, issued_date, deadline, max_grade, is_team
       FROM assignments WHERE course_id = $1
       ORDER BY issued_date NULLS LAST, id`,
      [courseId]
    );
    res.json({ assignments: rows });
  })
);

/** GET /api/assignments/:id — detail with materials, files, teams and (student) submission. */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const courseId = await getAssignmentCourse(id);
    const isTeacher = req.user!.role === 'teacher';
    if (isTeacher) await assertTeacherOwnsCourse(courseId, req.user!.id);
    else await assertStudentInCourse(courseId, req.user!.id);

    const a = await query(
      `SELECT a.*, subj.name AS subject
       FROM assignments a
       JOIN courses c ON c.id = a.course_id
       JOIN subjects subj ON subj.id = c.subject_id
       WHERE a.id = $1`,
      [id]
    );

    const files = await query(
      `SELECT f.id, f.original_name, f.size, f.mime
       FROM assignment_files af JOIN files f ON f.id = af.file_id
       WHERE af.assignment_id = $1`,
      [id]
    );

    const teams = await query(
      `SELECT t.id, t.name,
              COALESCE(json_agg(json_build_object('id', u.id, 'full_name', u.full_name))
                       FILTER (WHERE u.id IS NOT NULL), '[]') AS members
       FROM teams t
       LEFT JOIN team_members tm ON tm.team_id = t.id
       LEFT JOIN users u ON u.id = tm.student_id
       WHERE t.assignment_id = $1
       GROUP BY t.id ORDER BY t.name`,
      [id]
    );

    const result: any = { assignment: a.rows[0], files: files.rows, teams: teams.rows };

    if (!isTeacher) {
      const studentId = req.user!.id;
      // Find this student's submission (personal or via team).
      const sub = await query(
        `SELECT s.*, COALESCE(json_agg(json_build_object('id', f.id, 'original_name', f.original_name))
                              FILTER (WHERE f.id IS NOT NULL), '[]') AS files
         FROM submissions s
         LEFT JOIN submission_files sf ON sf.submission_id = s.id
         LEFT JOIN files f ON f.id = sf.file_id
         WHERE s.assignment_id = $1
           AND (s.student_id = $2 OR s.team_id IN (SELECT team_id FROM team_members WHERE student_id = $2))
         GROUP BY s.id
         ORDER BY s.submitted_at DESC LIMIT 1`,
        [id, studentId]
      );
      result.submission = sub.rows[0] ?? null;

      // Teammates (if the student is in a team for this assignment).
      const team = teams.rows.find((t: any) =>
        (t.members as any[]).some((m) => m.id === studentId)
      );
      result.team = team ?? null;
      result.teammates = team ? (team.members as any[]).filter((m) => m.id !== studentId) : [];
    }

    res.json(result);
  })
);

// ---- Teacher-only mutations below ----
const teacherOnly = [requireRole('teacher')];

const assignmentSchema = z.object({
  courseId: z.number().int().positive(),
  type: z.enum(['lab', 'theory', 'practice', 'control', 'test']),
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional().nullable(),
  materials: z.string().max(5000).optional().nullable(),
  issued_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  max_grade: z.number().int().min(1).max(100).default(100),
  is_team: z.boolean().default(false),
});

router.post(
  '/',
  ...teacherOnly,
  validate(assignmentSchema),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof assignmentSchema>;
    await assertTeacherOwnsCourse(b.courseId, req.user!.id);
    const { rows } = await query(
      `INSERT INTO assignments (course_id, type, title, description, materials, issued_date, deadline, max_grade, is_team)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [b.courseId, b.type, b.title, b.description ?? null, b.materials ?? null,
       b.issued_date ?? null, b.deadline ?? null, b.max_grade, b.is_team]
    );
    res.status(201).json({ assignment: rows[0] });
  })
);

const updateSchema = assignmentSchema.partial().omit({ courseId: true });

router.put(
  '/:id',
  ...teacherOnly,
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await assertTeacherOwnsCourse(await getAssignmentCourse(id), req.user!.id);
    const b = req.body as z.infer<typeof updateSchema>;
    const fields = ['type', 'title', 'description', 'materials', 'issued_date', 'deadline', 'max_grade', 'is_team'] as const;
    const sets: string[] = [];
    const vals: any[] = [];
    for (const f of fields) {
      if (b[f] !== undefined) {
        vals.push(b[f]);
        sets.push(`${f} = $${vals.length}`);
      }
    }
    if (!sets.length) return res.json({ ok: true });
    vals.push(id);
    const { rows } = await query(
      `UPDATE assignments SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`,
      vals
    );
    res.json({ assignment: rows[0] });
  })
);

router.delete(
  '/:id',
  ...teacherOnly,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await assertTeacherOwnsCourse(await getAssignmentCourse(id), req.user!.id);
    await query('DELETE FROM assignments WHERE id = $1', [id]);
    res.json({ ok: true });
  })
);

/** POST /api/assignments/:id/files — attach an already-uploaded file (ТЗ/material). */
router.post(
  '/:id/files',
  ...teacherOnly,
  validate(z.object({ fileId: z.number().int().positive() })),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await assertTeacherOwnsCourse(await getAssignmentCourse(id), req.user!.id);
    await query(
      `INSERT INTO assignment_files (assignment_id, file_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [id, req.body.fileId]
    );
    res.status(201).json({ ok: true });
  })
);

/** POST /api/assignments/:id/teams — create a team with members. */
const teamSchema = z.object({
  name: z.string().min(1).max(100),
  memberIds: z.array(z.number().int().positive()).min(1),
});

router.post(
  '/:id/teams',
  ...teacherOnly,
  validate(teamSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await assertTeacherOwnsCourse(await getAssignmentCourse(id), req.user!.id);
    const { name, memberIds } = req.body as z.infer<typeof teamSchema>;
    const team = await withTransaction(async (c) => {
      const t = await c.query(
        'INSERT INTO teams (assignment_id, name) VALUES ($1, $2) RETURNING id, name',
        [id, name]
      );
      for (const m of memberIds) {
        await c.query(
          'INSERT INTO team_members (team_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [t.rows[0].id, m]
        );
      }
      return t.rows[0];
    });
    res.status(201).json({ team });
  })
);

router.delete(
  '/:id/teams/:teamId',
  ...teacherOnly,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    await assertTeacherOwnsCourse(await getAssignmentCourse(id), req.user!.id);
    await query('DELETE FROM teams WHERE id = $1 AND assignment_id = $2', [
      Number(req.params.teamId),
      id,
    ]);
    res.json({ ok: true });
  })
);

export default router;
