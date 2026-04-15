import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import fs from 'fs';
import { config } from './config.js';
import type { PermissionDecisionResult, PermissionRequest, WsMessage } from './types.js';

const clients = new Set<WebSocket>();

function send(ws: WebSocket, msg: WsMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcast(msg: WsMessage): void {
  for (const ws of clients) {
    send(ws, msg);
  }
}

export function broadcastTeamsUpdate(): void {
  broadcast({ type: 'teams_update' });
}

export function broadcastTeamDetailUpdate(teamId: string): void {
  broadcast({ type: 'team_detail_update', teamId });
}

export function broadcastPermissionRequestPending(request: PermissionRequest): void {
  broadcast({ type: 'permission_request_pending', payload: request });
}

export function broadcastPermissionRequestResolved(result: PermissionDecisionResult): void {
  broadcast({ type: 'permission_request_resolved', payload: result });
}

export function initWebSocket(httpServer: Server): void {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    (ws as WebSocket & { isAlive: boolean }).isAlive = true;
    clients.add(ws);

    ws.on('pong', () => {
      (ws as WebSocket & { isAlive: boolean }).isAlive = true;
    });

    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.on('error', () => {
      clients.delete(ws);
    });
  });

  // Ping/pong keepalive every 30s using native WebSocket ping frames
  const pingInterval = setInterval(() => {
    for (const ws of clients) {
      const extWs = ws as WebSocket & { isAlive: boolean };
      if (!extWs.isAlive) {
        ws.terminate();
        clients.delete(ws);
        continue;
      }
      extWs.isAlive = false;
      ws.ping();
    }
  }, 30000);

  wss.on('close', () => clearInterval(pingInterval));

  // File watching with 300ms debounce
  let teamsDebounce: ReturnType<typeof setTimeout> | null = null;
  const teamDetailDebounces = new Map<string, ReturnType<typeof setTimeout>>();

  function scheduleTeamsUpdate(): void {
    if (teamsDebounce) clearTimeout(teamsDebounce);
    teamsDebounce = setTimeout(() => {
      broadcastTeamsUpdate();
    }, 300);
  }

  function scheduleTeamDetailUpdate(teamId: string): void {
    const existing = teamDetailDebounces.get(teamId);
    if (existing) clearTimeout(existing);
    teamDetailDebounces.set(teamId, setTimeout(() => {
      broadcastTeamDetailUpdate(teamId);
      teamDetailDebounces.delete(teamId);
    }, 300));
  }

  function watchDir(dir: string): fs.FSWatcher | null {
    try {
      return fs.watch(dir, { recursive: true }, (_event, filename) => {
        scheduleTeamsUpdate();

        // Check if the change is inside a known team subdirectory
        if (filename) {
          const parts = filename.toString().split(/[\\/]/);
          if (parts.length >= 1 && parts[0]) {
            scheduleTeamDetailUpdate(parts[0]);
          }
        }
      });
    } catch {
      // Dir may not exist yet; ignore
      return null;
    }
  }

  watchDir(config.teamsDir);
  watchDir(config.tasksDir);
}
