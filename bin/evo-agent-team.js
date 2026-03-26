#!/usr/bin/env node
// evo-agent-team CLI entry point
// Parses --cwd argument and starts the monitoring server.

import minimist from 'minimist';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverEntry = path.resolve(__dirname, '../server/dist/index.js');

/**
 * Expand ~/ in paths to home directory
 */
function expandHome(p) {
  if (p.startsWith('~')) {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

/**
 * Validate that a path is a valid, readable directory.
 * Returns { valid, error } tuple.
 */
function validateDirectory(p) {
  try {
    if (!fs.existsSync(p)) {
      return { valid: false, error: `Directory not found: ${p}` };
    }
    const stat = fs.statSync(p);
    if (!stat.isDirectory()) {
      return { valid: false, error: `Path is not a directory: ${p}` };
    }
    // Check readability by attempting to list
    fs.readdirSync(p);
    return { valid: true };
  } catch (err) {
    const msg = err?.code === 'EACCES' ? 'Permission denied' : err?.message || 'Unknown error';
    return { valid: false, error: `Cannot access directory: ${msg}` };
  }
}

async function main() {
  // Parse CLI arguments
  const argv = minimist(process.argv.slice(2), {
    string: ['cwd'],
    boolean: ['help', 'version'],
  });

  // Handle help
  if (argv.help) {
    console.log(`evo-agent-team - Monitor Claude Code agent teams

Usage:
  evo-agent-team [--cwd <path>] [--port <port>]

Options:
  --cwd <path>      Project directory to monitor (default: ~/.claude-internal)
  --port <port>     Server port (default: 3006)
  --help            Show this help message
  --version         Show version

Examples:
  evo-agent-team
  evo-agent-team --cwd /my/project
  evo-agent-team --cwd ~/my-project --port 3007
`);
    process.exit(0);
  }

  // Handle version (if needed, can read from package.json)
  if (argv.version) {
    console.log('1.0.0');
    process.exit(0);
  }

  // Process --cwd argument
  if (argv.cwd) {
    // Expand ~ and resolve relative paths
    const resolvedPath = path.resolve(expandHome(argv.cwd));

    // Validate the directory exists and is readable
    const validation = validateDirectory(resolvedPath);
    if (!validation.valid) {
      console.error(`Error: ${validation.error}`);
      process.exit(1);
    }

    // Set CWD environment variable for server to read
    process.env.CWD = resolvedPath;
    console.log(`[CLI] Monitoring project directory: ${resolvedPath}`);
  }

  // Process optional --port argument
  if (argv.port) {
    process.env.PORT = String(argv.port);
  }

  // Dynamically import and start the server
  try {
    await import(serverEntry);
  } catch (err) {
    console.error('Failed to start evo-agent-team:', err?.message || err);
    console.error('Did you run `npm run build` first?');
    process.exit(1);
  }
}

main();
