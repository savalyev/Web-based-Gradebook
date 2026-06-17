import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { query } from '../../config/db';
import { asyncHandler } from '../../utils/async';
import { requireAuth } from '../../middleware/auth';
import { env } from '../../config/env';
import { notFound, forbidden, HttpError } from '../../utils/errors';

const router = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

// Allowlist of extensions accepted for lab solutions / materials.
const ALLOWED_EXT = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.md', '.csv',
  '.zip', '.rar', '.7z', '.tar', '.gz',
  '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.js', '.ts', '.py', '.java', '.c', '.cpp', '.cs', '.sql', '.json', '.ipynb',
]);

const upload = multer({
  storage,
  limits: { fileSize: env.maxUploadBytes },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXT.has(ext)) return cb(null, true);
    cb(new HttpError(400, `Недопустимый тип файла: ${ext || 'без расширения'}`));
  },
});

/** POST /api/files — upload one file, returns its metadata record. */
router.post(
  '/',
  requireAuth,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw notFound('Файл не передан');
    // Original filename may arrive latin1-encoded; normalize to UTF-8.
    const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const { rows } = await query(
      `INSERT INTO files (original_name, stored_name, mime, size, uploaded_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, original_name, size, mime`,
      [originalName, req.file.filename, req.file.mimetype, req.file.size, req.user!.id]
    );
    res.status(201).json({ file: rows[0] });
  })
);

/** Checks whether the user may download the given file. */
async function canAccess(fileId: number, userId: number, role: string): Promise<boolean> {
  const owner = await query('SELECT uploaded_by FROM files WHERE id = $1', [fileId]);
  if (!owner.rows[0]) return false;
  if (owner.rows[0].uploaded_by === userId) return true;

  if (role === 'teacher') {
    const { rows } = await query(
      `SELECT 1
       FROM files f
       LEFT JOIN submission_files sf ON sf.file_id = f.id
       LEFT JOIN submissions s ON s.id = sf.submission_id
       LEFT JOIN assignment_files af ON af.file_id = f.id
       LEFT JOIN assignments a ON a.id = COALESCE(s.assignment_id, af.assignment_id)
       JOIN courses c ON c.id = a.course_id
       WHERE f.id = $1 AND c.teacher_id = $2`,
      [fileId, userId]
    );
    return rows.length > 0;
  }

  // Student: assignment materials of their course, or their own/team submission files.
  const { rows } = await query(
    `SELECT 1
     FROM files f
     LEFT JOIN assignment_files af ON af.file_id = f.id
     LEFT JOIN submission_files sf ON sf.file_id = f.id
     LEFT JOIN submissions s ON s.id = sf.submission_id
     LEFT JOIN assignments a ON a.id = COALESCE(af.assignment_id, s.assignment_id)
     JOIN courses c ON c.id = a.course_id
     JOIN student_profiles sp ON sp.group_id = c.group_id AND sp.user_id = $2
     WHERE f.id = $1`,
    [fileId, userId]
  );
  return rows.length > 0;
}

/** GET /api/files/:id — download with access control. */
router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const fileId = Number(req.params.id);
    const { rows } = await query('SELECT * FROM files WHERE id = $1', [fileId]);
    const file = rows[0];
    if (!file) throw notFound('Файл не найден');
    if (!(await canAccess(fileId, req.user!.id, req.user!.role))) throw forbidden();

    const fullPath = path.join(env.uploadDir, file.stored_name);
    if (!fs.existsSync(fullPath)) throw notFound('Файл отсутствует на диске');
    res.download(fullPath, file.original_name);
  })
);

export default router;
