import { Router } from 'express';
import { query } from '../../config/db';
import { asyncHandler } from '../../utils/async';
import { requireAuth } from '../../middleware/auth';

const router = Router();

/**
 * GET /api/schedule — weekly timetable for the current user.
 * Student → their group's courses; Teacher → courses they teach.
 */
router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const base = `
      SELECT ts.id, ts.weekday, ts.period_no, ts.room,
             b.starts_at, b.ends_at,
             subj.name AS subject, g.name AS group_name, u.full_name AS teacher_name,
             c.id AS course_id
      FROM timetable_slots ts
      JOIN bell_schedule b ON b.period_no = ts.period_no
      JOIN courses c ON c.id = ts.course_id
      JOIN subjects subj ON subj.id = c.subject_id
      JOIN groups g ON g.id = c.group_id
      JOIN users u ON u.id = c.teacher_id
    `;

    let rows;
    if (user.role === 'teacher') {
      ({ rows } = await query(`${base} WHERE c.teacher_id = $1 ORDER BY ts.weekday, ts.period_no`, [user.id]));
    } else {
      ({ rows } = await query(
        `${base}
         JOIN student_profiles sp ON sp.group_id = c.group_id
         WHERE sp.user_id = $1
         ORDER BY ts.weekday, ts.period_no`,
        [user.id]
      ));
    }
    res.json({ slots: rows });
  })
);

export default router;
