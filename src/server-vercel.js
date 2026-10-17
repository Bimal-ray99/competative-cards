// Vercel serverless entrypoint. The build config routes /api/* to this file;
// `createApp` is the regular Express app so middleware + routes work the same
// locally and on Vercel. No `listen` call here — Vercel invokes the handler.
import { createApp } from './app.js';

const app = createApp();

export default function handler(req, res) {
  return app(req, res);
}
