import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { query } from '../../config/db';
import { signToken } from '../../utils/jwt';
import { asyncHandler } from '../../utils/async';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { unauthorized, badRequest } from '../../utils/errors';
import { env } from '../../config/env';

const router = Router();

// Throttle login attempts to slow down brute-force / credential stuffing.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много попыток входа. Попробуйте позже.' },
});

const loginSchema = z.object({
  // Login identifier is a lookup key, not validated as a strict RFC email
  // (so demo logins like "teacher@demo" work too).
  email: z.string().min(1, 'Введите email').trim(),
  password: z.string().min(1, 'Введите пароль'),
});

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: env.isProd,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

router.post(
  '/login',
  loginLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof loginSchema>;
    const { rows } = await query(
      'SELECT id, email, password_hash, full_name, role FROM users WHERE email = $1',
      [email]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw unauthorized('Неверный email или пароль');
    }
    const payload = { id: user.id, role: user.role, email: user.email, fullName: user.full_name };
    const token = signToken(payload);
    res.cookie('token', token, COOKIE_OPTS);
    res.json({ user: payload });
  })
);

router.post('/logout', (_req, res) => {
  res.clearCookie('token', { ...COOKIE_OPTS, maxAge: undefined });
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Введите текущий пароль'),
  newPassword: z.string().min(4, 'Новый пароль минимум 4 символа'),
});

/** POST /api/auth/password — change own password (requires current). */
router.post(
  '/password',
  requireAuth,
  validate(passwordSchema),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body as z.infer<typeof passwordSchema>;
    const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user!.id]);
    if (!rows[0] || !(await bcrypt.compare(currentPassword, rows[0].password_hash))) {
      throw badRequest('Текущий пароль неверный');
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user!.id]);
    res.json({ ok: true });
  })
);

export default router;
