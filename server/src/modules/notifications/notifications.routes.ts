import { Router } from 'express';
import { query } from '../../config/db';
import { asyncHandler } from '../../utils/async';
import { requireAuth } from '../../middleware/auth';

const router = Router();
router.use(requireAuth);

/**
 * GET /api/notifications — current user's notifications + unread count.
 * For students, lazily generates "deadline approaching" notifications
 * (idempotently) for assignments due within 3 days and not yet submitted.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;

    if (req.user!.role === 'student') {
      await query(
        `INSERT INTO notifications (user_id, type, ref_id, title, body, link)
         SELECT $1, 'deadline', a.id, 'Скоро дедлайн', a.title, '/lab/' || a.id
         FROM assignments a
         JOIN courses c ON c.id = a.course_id
         JOIN student_profiles sp ON sp.group_id = c.group_id AND sp.user_id = $1
         WHERE a.deadline IS NOT NULL
           AND a.deadline >= CURRENT_DATE
           AND a.deadline <= CURRENT_DATE + INTERVAL '3 days'
           AND NOT EXISTS (
             SELECT 1 FROM submissions s
             WHERE s.assignment_id = a.id
               AND (s.student_id = $1
                    OR s.team_id IN (SELECT team_id FROM team_members WHERE student_id = $1))
           )
         ON CONFLICT (user_id, type, ref_id) DO NOTHING`,
        [userId]
      );
    }

    const { rows } = await query(
      `SELECT id, type, title, body, link, is_read, created_at
       FROM notifications WHERE user_id = $1
       ORDER BY is_read, created_at DESC LIMIT 50`,
      [userId]
    );
    const unread = rows.filter((r: any) => !r.is_read).length;
    res.json({ notifications: rows, unread });
  })
);

/** POST /api/notifications/read — mark all as read. */
router.post(
  '/read',
  asyncHandler(async (req, res) => {
    await query('UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false', [
      req.user!.id,
    ]);
    res.json({ ok: true });
  })
);

/** POST /api/notifications/:id/read — mark one as read. */
router.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    await query('UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2', [
      Number(req.params.id),
      req.user!.id,
    ]);
    res.json({ ok: true });
  })
);

export default router;
