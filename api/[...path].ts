import express, { Request, Response } from 'express';
import { apiRouter } from '../server/routes';

// Vercel serverless entry point.
// Do not import server.ts here because server.ts calls app.listen().
const app = express();

app.use(express.json({ limit: '15mb' }));
app.use('/api', apiRouter);

export default function handler(req: Request, res: Response) {
  app(req, res);
}
