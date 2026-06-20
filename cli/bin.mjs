#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const child = spawn(
  process.execPath,
  ['--import', 'tsx/esm', path.join(__dirname, 'index.ts'), ...process.argv.slice(2)],
  { stdio: 'inherit', windowsHide: true }
);
child.on('exit', (code) => process.exit(code ?? 1));
