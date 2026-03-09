#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const requiredFiles = [
  'firebase.json',
  'firestore.rules',
  'firestore.indexes.json',
  'functions/index.js',
  'web/src/App.tsx',
  'docs/deployment-checklist.md',
];

const requiredSecrets = ['ETORO_API_KEY', 'ETORO_USER_KEY'];

function readFirebaseConfig() {
  const filePath = path.join(process.cwd(), 'firebase.json');
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return null;
  }
}

function checkSecretHints() {
  const indexPath = path.join(process.cwd(), 'functions', 'index.js');
  const source = fs.readFileSync(indexPath, 'utf8');

  return requiredSecrets.map((secretName) => {
    const hasSecretBinding = source.includes(`defineSecret("${secretName}")`);
    return {
      secretName,
      ok: hasSecretBinding,
      detail: hasSecretBinding ? 'Secret binding found in functions runtime.' : 'Missing defineSecret binding in functions/index.js.',
    };
  });
}

function main() {
  console.log('eVaca deploy readiness checklist\n');

  const missingFiles = requiredFiles.filter((relativePath) => !fs.existsSync(path.join(process.cwd(), relativePath)));
  if (missingFiles.length === 0) {
    console.log('Files: OK');
  } else {
    console.log('Files: FAIL');
    missingFiles.forEach((file) => console.log(`  - Missing: ${file}`));
  }

  const firebaseConfig = readFirebaseConfig();
  if (!firebaseConfig) {
    console.log('firebase.json: FAIL (cannot parse)');
  } else {
    const hasFunctions = Array.isArray(firebaseConfig.functions) || typeof firebaseConfig.functions === 'object';
    const hasHosting = typeof firebaseConfig.hosting === 'object';
    const hasFirestore = typeof firebaseConfig.firestore === 'object';
    console.log(`firebase targets: ${hasFunctions && hasHosting && hasFirestore ? 'OK' : 'CHECK'}`);
  }

  console.log('\nSecrets (source-level verification):');
  const secretChecks = checkSecretHints();
  secretChecks.forEach(({ secretName, ok, detail }) => {
    console.log(`  - ${secretName}: ${ok ? 'OK' : 'FAIL'} (${detail})`);
  });

  console.log('\nManual step required: runtime secret existence must be verified with:');
  console.log('  firebase functions:secrets:access ETORO_API_KEY --project <project-id>');
  console.log('  firebase functions:secrets:access ETORO_USER_KEY --project <project-id>');

  if (missingFiles.length > 0 || secretChecks.some((item) => !item.ok)) {
    process.exitCode = 1;
  }
}

main();
