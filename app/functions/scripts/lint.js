#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TARGET_EXTENSIONS = new Set(['.js']);
const IGNORE_DIRS = new Set(['node_modules', 'coverage']);
const IGNORE_FILES = new Set([path.join(ROOT, 'scripts', 'lint.js')]);

const failures = [];

function collectFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath);
      continue;
    }

    if (TARGET_EXTENSIONS.has(path.extname(entry.name))) {
      lintFile(fullPath);
    }
  }
}

function lintFile(filePath) {
  if (IGNORE_FILES.has(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    const lineNo = index + 1;

    if (/\s+$/.test(line)) {
      failures.push(`${filePath}:${lineNo} trailing whitespace is not allowed`);
    }

    if (/\bvar\b/.test(line)) {
      failures.push(`${filePath}:${lineNo} use let/const instead of var`);
    }

    if (/\bdebugger\b/.test(line)) {
      failures.push(`${filePath}:${lineNo} debugger statements are not allowed`);
    }

    if (/\bconsole\.log\b/.test(line)) {
      failures.push(`${filePath}:${lineNo} console.log is not allowed in functions runtime code`);
    }
  });
}

collectFiles(ROOT);

if (failures.length > 0) {
  console.error('Functions lint failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Functions lint passed.');
