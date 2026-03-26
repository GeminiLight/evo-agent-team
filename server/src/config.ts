import { config as dotenvConfig } from 'dotenv';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import type { AppConfig } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: path.resolve(__dirname, '../../.env') });

function expandHome(p: string): string {
  if (p.startsWith('~')) {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

function parseDemoMode(val: string | undefined): AppConfig['demoMode'] {
  if (val === 'on' || val === 'off') return val;
  return 'auto';
}

/**
 * Resolve teams and tasks directories with precedence:
 * 1. CWD (from CLI --cwd, highest priority)
 * 2. TEAMS_DIR / TASKS_DIR env vars
 * 3. Default ~/.claude-internal/teams and ~/.claude-internal/tasks
 */
function resolveTeamsDir(): string {
  if (process.env.CWD) {
    return path.join(expandHome(process.env.CWD), '.claude-internal', 'teams');
  }
  if (process.env.TEAMS_DIR) {
    return expandHome(process.env.TEAMS_DIR);
  }
  return expandHome('~/.claude-internal/teams');
}

function resolveTasksDir(): string {
  if (process.env.CWD) {
    return path.join(expandHome(process.env.CWD), '.claude-internal', 'tasks');
  }
  if (process.env.TASKS_DIR) {
    return expandHome(process.env.TASKS_DIR);
  }
  return expandHome('~/.claude-internal/tasks');
}

export const config: AppConfig = {
  teamsDir: resolveTeamsDir(),
  tasksDir: resolveTasksDir(),
  port: parseInt(process.env.PORT || '3006', 10),
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '2000', 10),
  demoMode: parseDemoMode(process.env.DEMO_MODE),
};
