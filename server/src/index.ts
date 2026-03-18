import express from 'express';
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
app.use(express.json());
app.use('/api', apiRouter);

// Serve built client in production
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

const httpServer = app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
  console.log(`  Teams dir: ${config.teamsDir}`);
  console.log(`  Tasks dir: ${config.tasksDir}`);
  console.log(`  Demo mode: ${config.demoMode}`);
  console.log(`  Poll interval: ${config.pollIntervalMs}ms`);
});

initWebSocket(httpServer);
