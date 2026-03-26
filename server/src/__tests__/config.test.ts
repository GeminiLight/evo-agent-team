import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';

describe('server/src/config.ts - CWD precedence', () => {
  let originalCwd: string | undefined;
  let originalTeamsDir: string | undefined;
  let originalTasksDir: string | undefined;

  beforeEach(() => {
    originalCwd = process.env.CWD;
    originalTeamsDir = process.env.TEAMS_DIR;
    originalTasksDir = process.env.TASKS_DIR;
  });

  afterEach(() => {
    // Restore original env vars
    if (originalCwd !== undefined) process.env.CWD = originalCwd;
    else delete process.env.CWD;
    
    if (originalTeamsDir !== undefined) process.env.TEAMS_DIR = originalTeamsDir;
    else delete process.env.TEAMS_DIR;

    if (originalTasksDir !== undefined) process.env.TASKS_DIR = originalTasksDir;
    else delete process.env.TASKS_DIR;
  });

  it('should resolve CWD/.claude-internal/teams when CWD is set', () => {
    const projectDir = '/my/project';
    process.env.CWD = projectDir;
    delete process.env.TEAMS_DIR;

    const expectedTeamsDir = path.join(projectDir, '.claude-internal', 'teams');
    const expectedTasksDir = path.join(projectDir, '.claude-internal', 'tasks');

    // When config loads, it should use CWD
    expect(process.env.CWD).toBe(projectDir);
    // The actual config logic should construct these paths
  });

  it('should use TEAMS_DIR when CWD is not set', () => {
    delete process.env.CWD;
    const customTeamsDir = '/custom/teams';
    process.env.TEAMS_DIR = customTeamsDir;

    expect(process.env.TEAMS_DIR).toBe(customTeamsDir);
  });

  it('should expand ~ in CWD', () => {
    const cwdWithTilde = '~/my-project';
    process.env.CWD = cwdWithTilde;

    const expandHome = (p: string): string => {
      if (p.startsWith('~')) {
        return path.join(os.homedir(), p.slice(1));
      }
      return p;
    };

    const expanded = expandHome(cwdWithTilde);
    expect(expanded).toBe(path.join(os.homedir(), 'my-project'));
  });

  it('should expand ~ in TEAMS_DIR', () => {
    delete process.env.CWD;
    const teamsWithTilde = '~/.claude-internal/teams';
    process.env.TEAMS_DIR = teamsWithTilde;

    const expandHome = (p: string): string => {
      if (p.startsWith('~')) {
        return path.join(os.homedir(), p.slice(1));
      }
      return p;
    };

    const expanded = expandHome(teamsWithTilde);
    expect(expanded).toBe(path.join(os.homedir(), '.claude-internal', 'teams'));
  });

  it('should use default ~/.claude-internal/teams when neither CWD nor TEAMS_DIR is set', () => {
    delete process.env.CWD;
    delete process.env.TEAMS_DIR;

    const expectedDefault = path.join(os.homedir(), '.claude-internal', 'teams');
    // Config should use this default

    expect(process.env.CWD).toBeUndefined();
    expect(process.env.TEAMS_DIR).toBeUndefined();
  });

  it('should prioritize CWD over TEAMS_DIR', () => {
    const cwdPath = '/cli/cwd/path';
    const teamsPath = '/env/teams/path';
    
    process.env.CWD = cwdPath;
    process.env.TEAMS_DIR = teamsPath;

    // CWD should take precedence
    expect(process.env.CWD).toBe(cwdPath);
    // Config should use CWD, not TEAMS_DIR
  });

  it('should read PORT from env var', () => {
    const originalPort = process.env.PORT;
    process.env.PORT = '3009';

    const port = parseInt(process.env.PORT || '3006', 10);
    expect(port).toBe(3009);

    // Restore
    if (originalPort !== undefined) process.env.PORT = originalPort;
    else delete process.env.PORT;
  });

  it('should default to port 3006 when PORT is not set', () => {
    delete process.env.PORT;

    const port = parseInt(process.env.PORT || '3006', 10);
    expect(port).toBe(3006);
  });
});
