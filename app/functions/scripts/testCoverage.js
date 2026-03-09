#!/usr/bin/env node
const { spawnSync } = require('child_process');

const MIN_LINES = 50;
const MIN_BRANCHES = 60;
const MIN_FUNCTIONS = 70;

const result = spawnSync(
  process.execPath,
  ['--test', '--experimental-test-coverage'],
  { encoding: 'utf8' },
);

if (typeof result.stdout === 'string' && result.stdout.length > 0) {
  process.stdout.write(result.stdout);
}
if (typeof result.stderr === 'string' && result.stderr.length > 0) {
  process.stderr.write(result.stderr);
}

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const output = `${result.stdout || ''}\n${result.stderr || ''}`;
const coverageSummaryMatch = output.match(
  /all files\s+\|\s+([0-9.]+)\s+\|\s+([0-9.]+)\s+\|\s+([0-9.]+)/,
);

if (!coverageSummaryMatch) {
  console.error('Coverage summary not found in test output.');
  process.exit(1);
}

const lineCoverage = Number(coverageSummaryMatch[1]);
const branchCoverage = Number(coverageSummaryMatch[2]);
const functionCoverage = Number(coverageSummaryMatch[3]);
const failures = [];

if (lineCoverage < MIN_LINES) {
  failures.push(`lines ${lineCoverage}% < ${MIN_LINES}%`);
}
if (branchCoverage < MIN_BRANCHES) {
  failures.push(`branches ${branchCoverage}% < ${MIN_BRANCHES}%`);
}
if (functionCoverage < MIN_FUNCTIONS) {
  failures.push(`functions ${functionCoverage}% < ${MIN_FUNCTIONS}%`);
}

if (failures.length > 0) {
  console.error(`Coverage threshold failed: ${failures.join(', ')}`);
  process.exit(1);
}

process.exit(0);
