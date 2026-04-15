import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import apiRouter from './routes/index.js';
import { initWebSocket } from './websocket.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// When installed via npm: client assets are in dist/public (next to dist/index.js).
// When running from source (dev): fall back to client/dist.
const clientDist = path.resolve(__dirname, 'public');

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use('/api', apiRouter);

// Serve built client in production — disable caching to ensure fresh loads
app.disable('etag');
app.use(express.static(clientDist, {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  },
}));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(500).send('Dashboard not built. Run: npm run build');
  });
});

// Global error handler — prevent stack trace leaks
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[server] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

const httpServer = app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
  console.log(`  Project directory: ${process.env.CWD || '(default)'}`);
  console.log(`  Teams dir: ${config.teamsDir}`);
  console.log(`  Tasks dir: ${config.tasksDir}`);
  console.log(`  Demo mode: ${config.demoMode}`);
  console.log(`  Poll interval: ${config.pollIntervalMs}ms`);
});

initWebSocket(httpServer);
