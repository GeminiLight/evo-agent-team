import { config as dotenvConfig } from 'dotenv';
import os from 'os';
import path from 'path';
import type { AppConfig } from './types.js';

dotenvConfig({ path: path.resolve(import.meta.dirname, '../../.env') });

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

export const config: AppConfig = {
  teamsDir: expandHome(process.env.TEAMS_DIR || '~/.claude-internal/teams'),
  tasksDir: expandHome(process.env.TASKS_DIR || '~/.claude-internal/tasks'),
  port: parseInt(process.env.PORT || '3006', 10),
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '2000', 10),
  demoMode: parseDemoMode(process.env.DEMO_MODE),
};
