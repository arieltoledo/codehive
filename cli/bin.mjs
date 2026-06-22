#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const tsxEsmPath = require.resolve('tsx/esm');

const child = spawn(
  process.execPath,
  ['--import', tsxEsmPath, path.join(__dirname, 'index.ts'), ...process.argv.slice(2)],
  { stdio: 'inherit', windowsHide: true }
);
child.on('exit', (code) => process.exit(code ?? 1));
