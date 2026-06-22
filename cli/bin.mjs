#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const tsxLoader = pathToFileURL(require.resolve('tsx/esm')).href;

const child = spawn(
  process.execPath,
  ['--import', tsxLoader, path.join(__dirname, 'index.ts'), ...process.argv.slice(2)],
  { stdio: 'inherit', windowsHide: true }
);
child.on('exit', (code) => process.exit(code ?? 1));
