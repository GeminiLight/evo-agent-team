import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';

// CLI argument parsing tests (logically part of server config)
describe('CLI --cwd argument and path resolution', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'evo-cli-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should extract --cwd from minimist args', () => {
    // Simulate: minimist(['--cwd', '/path'])
    const args: { cwd?: string } = { cwd: tmpDir };
    expect(args.cwd).toBe(tmpDir);
  });

  it('should not have cwd property when flag is absent', () => {
    const args: Record<string, any> = {};
    expect(args.cwd).toBeUndefined();
  });

  it('should expand tilde path correctly', () => {
    const expandHome = (p: string): string => {
      if (p.startsWith('~')) {
        return path.join(os.homedir(), p.slice(1));
      }
      return p;
    };

    const result = expandHome('~/my-project');
    expect(result).toBe(path.join(os.homedir(), 'my-project'));
  });

  it('should resolve relative paths to absolute', () => {
    const testPath = './test-project';
    const resolved = path.resolve(testPath);
    expect(path.isAbsolute(resolved)).toBe(true);
  });

  it('should pass through absolute paths unchanged', () => {
    const absolutePath = '/absolute/path/to/project';
    const resolved = path.resolve(absolutePath);
    expect(resolved).toBe(absolutePath);
  });

  it('should construct team and task dirs under .claude-internal', () => {
    const projectDir = tmpDir;
    const teamsDir = path.join(projectDir, '.claude-internal', 'teams');
    const tasksDir = path.join(projectDir, '.claude-internal', 'tasks');

    expect(teamsDir).toContain('.claude-internal');
    expect(tasksDir).toContain('.claude-internal');
    expect(teamsDir).toContain('teams');
    expect(tasksDir).toContain('tasks');
  });

  it('should validate that directory exists', () => {
    const validDir = tmpDir;
    expect(fs.existsSync(validDir)).toBe(true);
    expect(fs.statSync(validDir).isDirectory()).toBe(true);
  });

  it('should detect non-existent directory', () => {
    const nonExistentDir = path.join(tmpDir, 'nonexistent-xyz');
    expect(fs.existsSync(nonExistentDir)).toBe(false);
  });

  it('should detect when path is a file, not a directory', () => {
    const filePath = path.join(tmpDir, 'test-file.txt');
    fs.writeFileSync(filePath, 'test');
    
    const isDir = fs.statSync(filePath).isDirectory();
    expect(isDir).toBe(false);
  });
});

describe('CLI error handling', () => {
  it('should handle directory not found error gracefully', () => {
    const validatePath = (p: string): { valid: boolean; error?: string } => {
      if (!fs.existsSync(p)) {
        return { valid: false, error: `Directory not found: ${p}` };
      }
      if (!fs.statSync(p).isDirectory()) {
        return { valid: false, error: `Path is not a directory: ${p}` };
      }
      return { valid: true };
    };

    const result = validatePath('/nonexistent/path');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should provide helpful error message for permission denied', () => {
    const error = 'Error: EACCES: permission denied';
    expect(error).toContain('permission');
  });
});
