import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRouter } from './routes/index.js';
import { securityHeaders } from './middleware/security.js';
import { rateLimit } from './middleware/rateLimit.js';
import { errorHandler, notFound } from './middleware/errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');

export function createApp(options = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '32kb' }));
  app.use(securityHeaders);
  app.use(rateLimit());
  app.use('/api', createRouter(options));
  app.use(express.static(PUBLIC_DIR, { extensions: ['html'], index: 'index.html' }));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
