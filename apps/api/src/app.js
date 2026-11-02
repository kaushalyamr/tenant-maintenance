import cookieParser from 'cookie-parser';
import express from 'express';

import { config } from './config.js';
import { cors } from './http/cors.js';
import { NotFoundError, errorMiddleware } from './http/errors.js';
import { authRouter } from './routes/auth.js';
import { caseRouter } from './routes/cases.js';
import { jobRouter } from './routes/jobs.js';
import { metaRouter } from './routes/meta.js';
import { registryRouter } from './routes/registry.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors(config.webOrigin));
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());

  app.use('/api', metaRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/cases', caseRouter);
  app.use('/api/jobs', jobRouter);
  app.use('/api', registryRouter);

  app.use((req, _res, next) => next(new NotFoundError(`No endpoint for ${req.method} ${req.path}.`)));
  app.use(errorMiddleware);

  return app;
}
