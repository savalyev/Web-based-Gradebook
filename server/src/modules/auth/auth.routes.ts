import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../../config/db';
import { signToken } from '../../utils/jwt';
import { asyncHandler } from '../../utils/async';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { unauthorized } from '../../utils/errors';
import { env } from '../../config/env';

const router = Router();

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

export default router;
