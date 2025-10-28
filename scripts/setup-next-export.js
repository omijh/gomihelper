const { chmodSync, existsSync, mkdirSync, writeFileSync, unlinkSync } = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const binDir = path.join(projectRoot, 'node_modules', '.bin');
const wrapperRel = path.relative(binDir, path.join(__dirname, 'next-wrapper.js'));

if (!existsSync(binDir)) {
  mkdirSync(binDir, { recursive: true });
}

const unixScript = `#!/usr/bin/env node\nrequire(${JSON.stringify(wrapperRel)});\n`;
const unixPath = path.join(binDir, 'next');
try {
  unlinkSync(unixPath);
} catch {}
writeFileSync(unixPath, unixScript);
chmodSync(unixPath, 0o755);

const winScript = `@IF EXIST "%~dp0\\node.exe" (\n  "%~dp0\\node.exe"  "%~dp0\\..\\..\\scripts\\next-wrapper.js" %*\n) ELSE (\n  node  "%~dp0\\..\\..\\scripts\\next-wrapper.js" %*\n)\n`;
const winPath = path.join(binDir, 'next.cmd');
try {
  unlinkSync(winPath);
} catch {}
writeFileSync(winPath, winScript);
