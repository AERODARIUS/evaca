# SOTRY-14: Test strategy and coverage targets

## Story ID and title
- `SOTRY-14` Test strategy and coverage targets

## What was implemented
- Extracted deterministic alert form logic into `alertFormLogic.ts` to improve unit-testability without changing user-visible behavior.
- Added unit tests covering:
  - validation rules and submit payload construction paths.
  - condition toggle transitions and icon/label synchronization.
  - asset search deterministic states (`loading`, `results`, `empty`, `error` mapping).
- Kept action coverage for edit/delete/enable-disable alert behaviors through integration tests in `alerts.integration.test.ts`.
- Refactored `AlertForm` to consume tested helper logic for validation, payload assembly, search feedback, and condition presentation.

## Files changed
- `app/web/src/lib/alertFormLogic.ts`
- `app/web/src/lib/alertFormLogic.test.ts`
- `app/web/src/components/AlertForm.tsx`

## Tests executed and results
- `npm run web:test` ✅ passed (`4` files, `14` tests)

## Notes/limitations
- Enforcing Vitest coverage thresholds in CI for the web workspace requires `@vitest/coverage-v8` (or `@vitest/coverage-istanbul`), which could not be installed in this environment due restricted network access (`ENOTFOUND registry.npmjs.org`).
