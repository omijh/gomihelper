#!/usr/bin/env node
const { cpSync, existsSync, rmSync } = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const projectRoot = path.join(__dirname, '..');
const realNext = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');

if (args[0] === 'export') {
  let outDir = 'out';
  const ignored = [];
  for (let i = 1; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '-o' || arg === '--out' || arg === '--outdir' || arg === '--output') {
      const value = args[i + 1];
      if (!value) {
        console.error('Missing directory for', arg);
        process.exit(1);
      }
      outDir = value;
      i += 1;
      continue;
    }
    ignored.push(arg);
  }
  if (ignored.length) {
    console.warn('Ignoring unsupported export arguments:', ignored.join(' '));
  }
  const buildOut = path.join(projectRoot, 'out');
  if (!existsSync(buildOut)) {
    console.error('Static output not found. Run `npm run build` first.');
    process.exit(1);
  }
  const target = path.resolve(projectRoot, outDir);
  if (path.resolve(buildOut) !== target) {
    rmSync(target, { recursive: true, force: true });
    cpSync(buildOut, target, { recursive: true });
  }
  console.log(`Static export ready at ${target}`);
  process.exit(0);
}

const result = spawnSync(process.execPath, [realNext, ...args], { stdio: 'inherit' });
if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status ?? 0);
