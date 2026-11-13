import express from 'express';
import path from 'path';
import { apiRouter } from './server/routes.js';
import { initializeDatabase } from './server/db.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database on startup
initializeDatabase();

app.use(express.json({ limit: '15mb' }));
app.use('/api', apiRouter);

// Serve static frontend in production
const distPath = path.resolve(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Portal Digital Terpadu server running on http://0.0.0.0:${PORT}`);
});

export default app;
