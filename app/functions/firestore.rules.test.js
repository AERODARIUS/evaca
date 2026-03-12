const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rulesPath = path.resolve(__dirname, '..', 'firestore.rules');

function loadRules() {
  return fs.readFileSync(rulesPath, 'utf8');
}

test('alerts and notifications reads are owner-scoped', () => {
  const rules = loadRules();

  assert.match(rules, /match \/alerts\/\{alertId\}[\s\S]*allow read: if isOwner\(resource\.data\.userId\);/);
  assert.match(rules, /match \/notifications\/\{notificationId\}[\s\S]*allow read: if isOwner\(resource\.data\.userId\);/);
});

test('alerts updates keep user ownership and createdAt immutable', () => {
  const rules = loadRules();

  assert.match(rules, /allow update: if isOwner\(resource\.data\.userId\)/);
  assert.match(rules, /request\.resource\.data\.userId == resource\.data\.userId/);
  assert.match(rules, /request\.resource\.data\.createdAt == resource\.data\.createdAt/);
});

test('notifications client writes are blocked', () => {
  const rules = loadRules();

  assert.match(rules, /match \/notifications\/\{notificationId\}[\s\S]*allow create, update, delete: if false;/);
});
