import { Router } from 'express';
import ExcelJS from 'exceljs';
import { query } from '../../config/db';
import { asyncHandler } from '../../utils/async';
import { requireAuth, requireRole } from '../../middleware/auth';
import { assertTeacherOwnsCourse } from '../../utils/access';

const router = Router();
router.use(requireAuth);

const BRAND = 'FFDC2626';
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };

function attMark(att: string): string {
  if (att === 'absent') return 'Н';
  if (att === 'late') return 'О';
  return '';
}

async function send(res: any, wb: ExcelJS.Workbook, filename: string) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  await wb.xlsx.write(res);
  res.end();
}

/** GET /api/export/journal/:courseId — teacher journal grid as .xlsx */
router.get(
  '/journal/:courseId',
  requireRole('teacher'),
  asyncHandler(async (req, res) => {
    const courseId = Number(req.params.courseId);
    const course = await assertTeacherOwnsCourse(courseId, req.user!.id);

    const meta = await query(
      `SELECT subj.name AS subject, g.name AS group_name
       FROM courses c JOIN subjects subj ON subj.id = c.subject_id
       JOIN groups g ON g.id = c.group_id WHERE c.id = $1`,
      [courseId]
    );
    const students = await query(
      `SELECT u.id, u.full_name FROM student_profiles sp JOIN users u ON u.id = sp.user_id
       WHERE sp.group_id = $1 ORDER BY u.full_name`,
      [course.group_id]
    );
    const lessons = await query(
      `SELECT id, date FROM lessons WHERE course_id = $1 ORDER BY date, period_no`,
      [courseId]
    );
    const entries = await query(
      `SELECT ge.lesson_id, ge.student_id, ge.grade, ge.attendance
       FROM grade_entries ge JOIN lessons l ON l.id = ge.lesson_id WHERE l.course_id = $1`,
      [courseId]
    );
    const map = new Map<string, any>();
    for (const e of entries.rows) map.set(`${e.lesson_id}:${e.student_id}`, e);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Журнал');
    ws.addRow([`${meta.rows[0]?.subject} — ${meta.rows[0]?.group_name}`]);
    ws.getRow(1).font = { bold: true, size: 14 };

    const header = ['Студент', ...lessons.rows.map((l: any) =>
      new Date(l.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
    )];
    const hr = ws.addRow(header);
    hr.eachCell((c) => {
      c.fill = HEADER_FILL;
      c.font = { color: { argb: 'FFFFFFFF' }, bold: true };
      c.alignment = { horizontal: 'center' };
    });

    for (const st of students.rows) {
      const row = [st.full_name];
      for (const l of lessons.rows) {
        const e = map.get(`${l.id}:${st.id}`);
        row.push(e ? (e.grade != null ? String(e.grade) : attMark(e.attendance)) : '');
      }
      ws.addRow(row);
    }
    ws.getColumn(1).width = 32;
    for (let i = 2; i <= header.length; i++) ws.getColumn(i).width = 7;

    await send(res, wb, `journal_${meta.rows[0]?.group_name ?? courseId}.xlsx`);
  })
);

/** GET /api/export/submissions/:courseId — submissions sheet as .xlsx */
router.get(
  '/submissions/:courseId',
  requireRole('teacher'),
  asyncHandler(async (req, res) => {
    const courseId = Number(req.params.courseId);
    await assertTeacherOwnsCourse(courseId, req.user!.id);

    const { rows } = await query(
      `SELECT a.title, COALESCE(u.full_name, t.name) AS who,
              s.submitted_at, s.grade, s.status, a.deadline,
              (s.submitted_at::date > a.deadline) AS is_late
       FROM submissions s
       JOIN assignments a ON a.id = s.assignment_id
       LEFT JOIN users u ON u.id = s.student_id
       LEFT JOIN teams t ON t.id = s.team_id
       WHERE a.course_id = $1 ORDER BY s.submitted_at DESC`,
      [courseId]
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Сдачи');
    const header = ['Работа', 'Студент/команда', 'Сдано', 'Дедлайн', 'Просрочено', 'Оценка', 'Статус'];
    const hr = ws.addRow(header);
    hr.eachCell((c) => {
      c.fill = HEADER_FILL;
      c.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    });
    for (const r of rows) {
      ws.addRow([
        r.title,
        r.who,
        new Date(r.submitted_at).toLocaleDateString('ru-RU'),
        r.deadline ? new Date(r.deadline).toLocaleDateString('ru-RU') : '—',
        r.is_late ? 'да' : 'нет',
        r.grade ?? '',
        r.status === 'reviewed' ? 'Проверено' : 'Ожидает',
      ]);
    }
    ws.columns.forEach((c) => (c.width = 22));
    await send(res, wb, `submissions_${courseId}.xlsx`);
  })
);

/** GET /api/export/student-journal — the student's own grades as .xlsx */
router.get(
  '/student-journal',
  requireRole('student'),
  asyncHandler(async (req, res) => {
    const studentId = req.user!.id;
    const { rows } = await query(
      `SELECT subj.name AS subject, l.date, l.topic, ge.grade, ge.attendance
       FROM courses c
       JOIN subjects subj ON subj.id = c.subject_id
       JOIN student_profiles sp ON sp.group_id = c.group_id AND sp.user_id = $1
       JOIN lessons l ON l.course_id = c.id
       LEFT JOIN grade_entries ge ON ge.lesson_id = l.id AND ge.student_id = $1
       ORDER BY subj.name, l.date`,
      [studentId]
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Мои оценки');
    const hr = ws.addRow(['Предмет', 'Дата', 'Тема', 'Оценка', 'Посещаемость']);
    hr.eachCell((c) => {
      c.fill = HEADER_FILL;
      c.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    });
    for (const r of rows) {
      ws.addRow([
        r.subject,
        new Date(r.date).toLocaleDateString('ru-RU'),
        r.topic ?? '',
        r.grade ?? '',
        r.attendance === 'absent' ? 'Н' : r.attendance === 'late' ? 'Опоздание' : 'Был',
      ]);
    }
    ws.columns.forEach((c) => (c.width = 24));
    await send(res, wb, `my_grades.xlsx`);
  })
);

export default router;
