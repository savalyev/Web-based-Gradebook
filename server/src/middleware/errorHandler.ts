import { ErrorRequestHandler, RequestHandler } from 'express';
import { HttpError } from '../utils/errors';
import { env } from '../config/env';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Маршрут не найден' });
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }

  // Friendly messages for common PostgreSQL constraint violations.
  const code = (err as any)?.code;
  if (code === '23505') {
    return res.status(409).json({ error: 'Такая запись уже существует' });
  }
  if (code === '23503') {
    return res.status(409).json({ error: 'Нельзя выполнить: есть связанные данные' });
  }

  if (!env.isProd) {
    // eslint-disable-next-line no-console
    console.error(err);
  }
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
};
