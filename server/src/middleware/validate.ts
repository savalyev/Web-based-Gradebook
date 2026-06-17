import { RequestHandler } from 'express';
import { ZodSchema } from 'zod';
import { badRequest } from '../utils/errors';

type Source = 'body' | 'query' | 'params';

/** Validates and replaces req[source] with the parsed (typed) value. */
export const validate =
  (schema: ZodSchema, source: Source = 'body'): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(badRequest('Ошибка валидации', result.error.flatten()));
    }
    (req as any)[source] = result.data;
    next();
  };
