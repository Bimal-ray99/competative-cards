export function notFound(_req, res) {
  res.status(404).json({ error: 'Not found' });
}

export function errorHandler(err, _req, res, _next) {
  const status = err && Number.isInteger(err.statusCode) ? err.statusCode : 500;
  const message =
    status < 500 && err && typeof err.message === 'string' ? err.message : 'Internal server error';
  if (status >= 500) {
    console.error('[error]', err);
  }
  res.status(status).json({ error: message });
}
