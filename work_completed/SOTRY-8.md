# SOTRY-8: Testing

## Story ID and title
- `SOTRY-8` Testing

## What was implemented
- Added web integration tests for alert data operations (`createAlert`, `listAlerts`, `updateAlert`, `toggleAlertActive`, `deleteAlert`) with deterministic Firestore mocks.
- Extracted scheduled alert evaluator logic in Functions into `runAlertEvaluation` for deterministic testability.
- Added Functions integration/emulator-style tests for alert trigger flow:
  - notification creation + sent status update when condition matches.
  - duplicate notification suppression when condition remains true across checks.
- Kept production behavior intact by preserving `checkAlerts` scheduling path and delegating to the extracted evaluator.

## Files changed
- `app/functions/index.js`
- `app/functions/index.test.js`
- `app/web/src/lib/alerts.integration.test.ts`

## Tests executed and results
- `npm run web:test` ✅ passed (`3` files, `9` tests)
- `npm run functions:test` ✅ passed (`22` tests)

## Notes/limitations
- Emulator-style coverage is implemented through deterministic Firestore/Functions dependency injection and mocks rather than spinning up the Firebase Emulator Suite process.
