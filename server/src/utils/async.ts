import { RequestHandler } from 'express';

/** Wraps async route handlers so thrown errors reach the error middleware. */
export const asyncHandler =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);
