import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query, withTransaction } from '../../config/db';
import { asyncHandler } from '../../utils/async';
import { requireAuth, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { conflict, notFound, badRequest } from '../../utils/errors';

const router = Router();
router.use(requireAuth, requireRole('admin'));

/* ----------------------------- Users ----------------------------- */

/** GET /api/admin/users?role= — list users with student group/status. */
router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const role = req.query.role as string | undefined;
    const params: any[] = [];
    let where = '';
    if (role) {
      params.push(role);
      where = 'WHERE u.role = $1';
    }
    const { rows } = await query(
      `SELECT u.id, u.email, u.full_name, u.role, u.created_at,
              sp.group_id, sp.status, g.name AS group_name
       FROM users u
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       LEFT JOIN groups g ON g.id = sp.group_id
       ${where}
       ORDER BY u.role, u.full_name`,
      params
    );
    res.json({ users: rows });
  })
);

const createUserSchema = z.object({
  email: z.string().min(1).trim(),
  password: z.string().min(4, 'Пароль минимум 4 символа'),
  full_name: z.string().min(1).max(200),
  role: z.enum(['student', 'teacher', 'admin']),
  group_id: z.number().int().positive().nullable().optional(),
  status: z.enum(['active', 'new', 'expelled']).optional(),
});

/** POST /api/admin/users — create a teacher / student / admin. */
router.post(
  '/users',
  validate(createUserSchema),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof createUserSchema>;
    const dup = await query('SELECT 1 FROM users WHERE email = $1', [b.email]);
    if (dup.rowCount > 0) throw conflict('Пользователь с таким email уже существует');

    const hash = await bcrypt.hash(b.password, 10);
    const user = await withTransaction(async (c) => {
      const u = await c.query(
        `INSERT INTO users (email, password_hash, full_name, role)
         VALUES ($1, $2, $3, $4) RETURNING id, email, full_name, role`,
        [b.email, hash, b.full_name, b.role]
      );
      if (b.role === 'student') {
        await c.query(
          `INSERT INTO student_profiles (user_id, group_id, status) VALUES ($1, $2, $3)`,
          [u.rows[0].id, b.group_id ?? null, b.status ?? 'new']
        );
      }
      return u.rows[0];
    });
    res.status(201).json({ user });
  })
);

const updateUserSchema = z.object({
  full_name: z.string().min(1).max(200).optional(),
  password: z.string().min(4).optional(),
  group_id: z.number().int().positive().nullable().optional(),
  status: z.enum(['active', 'new', 'expelled']).optional(),
});

/** PATCH /api/admin/users/:id — update name/password and (students) group/status. */
router.patch(
  '/users/:id',
  validate(updateUserSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const b = req.body as z.infer<typeof updateUserSchema>;
    const u = await query('SELECT id, role FROM users WHERE id = $1', [id]);
    if (!u.rows[0]) throw notFound('Пользователь не найден');

    if (b.full_name !== undefined) {
      await query('UPDATE users SET full_name = $1 WHERE id = $2', [b.full_name, id]);
    }
    if (b.password !== undefined) {
      const hash = await bcrypt.hash(b.password, 10);
      await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, id]);
    }
    if (u.rows[0].role === 'student' && (b.group_id !== undefined || b.status !== undefined)) {
      await query(
        `UPDATE student_profiles
         SET group_id = COALESCE($1, group_id), status = COALESCE($2, status)
         WHERE user_id = $3`,
        [b.group_id ?? null, b.status ?? null, id]
      );
    }
    res.json({ ok: true });
  })
);

/** DELETE /api/admin/users/:id */
router.delete(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (id === req.user!.id) throw badRequest('Нельзя удалить самого себя');
    const r = await query('DELETE FROM users WHERE id = $1', [id]);
    if (r.rowCount === 0) throw notFound('Пользователь не найден');
    res.json({ ok: true });
  })
);

/* --------------- Simple dictionaries: groups / subjects --------------- */

function dictionary(path: string, table: string) {
  router.get(
    `/${path}`,
    asyncHandler(async (_req, res) => {
      const { rows } = await query(`SELECT id, name FROM ${table} ORDER BY name`);
      res.json({ [path]: rows });
    })
  );
  router.post(
    `/${path}`,
    validate(z.object({ name: z.string().min(1).max(200) })),
    asyncHandler(async (req, res) => {
      const { rows } = await query(`INSERT INTO ${table} (name) VALUES ($1) RETURNING id, name`, [
        req.body.name,
      ]);
      res.status(201).json({ item: rows[0] });
    })
  );
  router.delete(
    `/${path}/:id`,
    asyncHandler(async (req, res) => {
      const r = await query(`DELETE FROM ${table} WHERE id = $1`, [Number(req.params.id)]);
      if (r.rowCount === 0) throw notFound('Не найдено');
      res.json({ ok: true });
    })
  );
}
dictionary('groups', 'groups');
dictionary('subjects', 'subjects');

/* ----------------------------- Courses ----------------------------- */

router.get(
  '/courses',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT c.id, c.subject_id, c.group_id, c.teacher_id,
              subj.name AS subject, g.name AS group_name, u.full_name AS teacher_name
       FROM courses c
       JOIN subjects subj ON subj.id = c.subject_id
       JOIN groups g ON g.id = c.group_id
       JOIN users u ON u.id = c.teacher_id
       ORDER BY subj.name, g.name`
    );
    res.json({ courses: rows });
  })
);

router.post(
  '/courses',
  validate(
    z.object({
      subject_id: z.number().int().positive(),
      group_id: z.number().int().positive(),
      teacher_id: z.number().int().positive(),
    })
  ),
  asyncHandler(async (req, res) => {
    const { subject_id, group_id, teacher_id } = req.body;
    const t = await query(`SELECT 1 FROM users WHERE id = $1 AND role = 'teacher'`, [teacher_id]);
    if (!t.rows[0]) throw badRequest('Указанный преподаватель не найден');
    const dup = await query(
      'SELECT 1 FROM courses WHERE subject_id = $1 AND group_id = $2 AND teacher_id = $3',
      [subject_id, group_id, teacher_id]
    );
    if (dup.rowCount > 0) throw conflict('Такой курс уже существует');
    const { rows } = await query(
      `INSERT INTO courses (subject_id, group_id, teacher_id) VALUES ($1, $2, $3) RETURNING id`,
      [subject_id, group_id, teacher_id]
    );
    res.status(201).json({ id: rows[0].id });
  })
);

router.delete(
  '/courses/:id',
  asyncHandler(async (req, res) => {
    const r = await query('DELETE FROM courses WHERE id = $1', [Number(req.params.id)]);
    if (r.rowCount === 0) throw notFound('Курс не найден');
    res.json({ ok: true });
  })
);

/* --------------------------- Timetable --------------------------- */

router.get(
  '/bells',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      'SELECT period_no, starts_at, ends_at FROM bell_schedule ORDER BY period_no'
    );
    res.json({ bells: rows });
  })
);

router.get(
  '/timetable',
  asyncHandler(async (_req, res) => {
    const { rows } = await query(
      `SELECT ts.id, ts.course_id, ts.weekday, ts.period_no, ts.room,
              b.starts_at, b.ends_at,
              subj.name AS subject, g.name AS group_name, u.full_name AS teacher_name
       FROM timetable_slots ts
       JOIN bell_schedule b ON b.period_no = ts.period_no
       JOIN courses c ON c.id = ts.course_id
       JOIN subjects subj ON subj.id = c.subject_id
       JOIN groups g ON g.id = c.group_id
       JOIN users u ON u.id = c.teacher_id
       ORDER BY ts.weekday, ts.period_no`
    );
    res.json({ slots: rows });
  })
);

router.post(
  '/timetable',
  validate(
    z.object({
      course_id: z.number().int().positive(),
      weekday: z.number().int().min(1).max(7),
      period_no: z.number().int().positive(),
      room: z.string().max(50).optional().nullable(),
    })
  ),
  asyncHandler(async (req, res) => {
    const { course_id, weekday, period_no, room } = req.body;
    const dup = await query(
      'SELECT 1 FROM timetable_slots WHERE course_id = $1 AND weekday = $2 AND period_no = $3',
      [course_id, weekday, period_no]
    );
    if (dup.rowCount > 0) throw conflict('Слот на это время уже есть');
    const { rows } = await query(
      `INSERT INTO timetable_slots (course_id, weekday, period_no, room)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [course_id, weekday, period_no, room ?? null]
    );
    res.status(201).json({ id: rows[0].id });
  })
);

router.delete(
  '/timetable/:id',
  asyncHandler(async (req, res) => {
    const r = await query('DELETE FROM timetable_slots WHERE id = $1', [Number(req.params.id)]);
    if (r.rowCount === 0) throw notFound('Слот не найден');
    res.json({ ok: true });
  })
);

export default router;
