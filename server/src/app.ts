import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { env } from './config/env';
import { notFoundHandler, errorHandler } from './middleware/errorHandler';

import authRoutes from './modules/auth/auth.routes';
import scheduleRoutes from './modules/schedule/schedule.routes';
import studentRoutes from './modules/student/student.routes';
import courseRoutes from './modules/courses/courses.routes';
import gradeRoutes from './modules/journal/grades.routes';
import assignmentRoutes from './modules/assignments/assignments.routes';
import submissionRoutes from './modules/submissions/submissions.routes';
import fileRoutes from './modules/files/files.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import adminRoutes from './modules/admin/admin.routes';
import notificationRoutes from './modules/notifications/notifications.routes';
import exportRoutes from './modules/export/export.routes';

export function createApp() {
  const app = express();

  // Behind nginx in production: required for secure cookies & correct client IPs.
  if (env.trustProxy > 0) app.set('trust proxy', env.trustProxy);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRoutes);
  app.use('/api/schedule', scheduleRoutes);
  app.use('/api/student', studentRoutes);
  app.use('/api/courses', courseRoutes);
  app.use('/api/grades', gradeRoutes);
  app.use('/api/assignments', assignmentRoutes);
  app.use('/api/submissions', submissionRoutes);
  app.use('/api/files', fileRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/export', exportRoutes);

  // Unknown API routes → JSON 404.
  app.use('/api', notFoundHandler);

  // Serve the built client (single-origin) with SPA fallback, if present.
  if (fs.existsSync(env.clientDist)) {
    app.use(express.static(env.clientDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(env.clientDist, 'index.html'));
    });
  }

  app.use(errorHandler);

  return app;
}
