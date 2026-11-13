import express, { Request, Response, NextFunction } from 'express';
import { apiRouter } from '../server/routes.js';
import { loadDatabase, getDbFile } from '../server/db.js';

// Vercel Serverless Function Entry Point (/api/index.ts).
// Do NOT import ../server.ts here because server.ts calls app.listen().
const app = express();

// Safe JSON body parser for Vercel: prevents hanging or "stream is not readable"
// if Vercel's Node wrapper has already parsed or consumed req.body.
const jsonParser = express.json({ limit: '15mb' });
app.use((req: Request, res: Response, next: NextFunction) => {
  const anyReq = req as any;
  if (anyReq._body || req.body !== undefined) {
    if (typeof req.body === 'string') {
      try {
        req.body = JSON.parse(req.body);
      } catch {
        // keep string as-is
      }
    }
    anyReq._body = true;
    next();
    return;
  }
  jsonParser(req, res, (err: any) => {
    if (err) {
      res.status(400).json({ success: false, error: 'Payload JSON tidak valid.' });
      return;
    }
    next();
  });
});

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

app.get('/api/health', (_req: Request, res: Response) => {
  try {
    const db = loadDatabase();
    res.json({
      ok: true,
      runtime: 'vercel-serverless-ts',
      dbFile: getDbFile(),
      usersCount: db.USERS.length,
      linksCount: db.LINKS.length,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || 'Health check failed' });
  }
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

export default function handler(req: any, res: any) {
  try {
    return app(req, res);
  } catch (err: any) {
    console.error('Unhandled Vercel Handler Error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          success: false,
          error: err?.message || 'Terjadi kesalahan fatal pada fungsi API.',
        })
      );
    }
  }
}
