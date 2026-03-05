#!/usr/bin/env node
// evo-agent-team CLI entry point
// Resolves the compiled server entry and starts it.

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// The published package layout is:
//   bin/evo-agent-team.js   ← this file
//   server/dist/index.js    ← compiled server
const serverEntry = path.resolve(__dirname, '../server/dist/index.js');

// Dynamically import the compiled server so it starts up.
import(serverEntry).catch(err => {
  console.error('Failed to start evo-agent-team:', err.message);
  console.error('Did you run `npm run build` first?');
  process.exit(1);
});
