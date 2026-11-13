import express, { Request, Response, NextFunction } from 'express';
import { apiRouter } from '../server/routes';

// Vercel serverless entry point.
// Do not import server.ts here because server.ts calls app.listen().
const app = express();

app.use(express.json({ limit: '15mb' }));

// Ensure rewritten /api/(.*) requests preserve their full /api/... path in Express
app.use((req: Request, _res: Response, next: NextFunction) => {
  const rawPath = req.query?.__path;
  if (typeof rawPath === 'string' && rawPath.length > 0) {
    const cleanPath = rawPath.replace(/^\/+/, '');
    const targetPrefix = `/api/${cleanPath}`;
    if (!req.url.startsWith(targetPrefix)) {
      const qIdx = req.url.indexOf('?');
      const rawSearch = qIdx >= 0 ? req.url.slice(qIdx) : '';
      const params = new URLSearchParams(rawSearch);
      params.delete('__path');
      const rest = params.toString();
      req.url = `${targetPrefix}${rest ? `?${rest}` : ''}`;
    }
  }
  next();
});

app.use('/api', apiRouter);

// Always return JSON on unexpected server errors
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Vercel API Error:', err);
  if (!res.headersSent) {
    res.status(err?.status || 500).json({
      success: false,
      error: err?.message || 'Terjadi kesalahan internal server.',
    });
  }
});

export default app;
