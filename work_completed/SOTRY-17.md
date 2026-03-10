# SOTRY-17: Automated accessibility testing in pipeline

## Story ID and title
- `SOTRY-17` Automated accessibility testing in pipeline

## What was implemented
- Added dedicated automated a11y-oriented tests for New Alert form behavior using deterministic helper-level checks:
  - default/loading/empty/success textual state feedback.
  - text-based validation errors and non-color state labels (`Above`/`Below`).
- Added `web:test:a11y` script and wired it into root workspace scripts.
- Added CI gate in both PR and merge workflows to run accessibility checks on every pipeline run.
- Added a lightweight manual accessibility checklist for PR reviewers.

## Files changed
- `.github/workflows/firebase-hosting-pull-request.yml`
- `.github/workflows/firebase-hosting-merge.yml`
- `app/package.json`
- `app/web/package.json`
- `app/web/src/lib/alertA11y.test.ts`
- `app/docs/accessibility-checklist.md`

## Tests executed and results
- `npm run web:test:a11y` ✅ passed (`2` files, `8` tests)
- `npm run web:test` ✅ passed (`5` files, `17` tests)

## Notes/limitations
- Due offline dependency constraints, a `jest-axe`-style engine was not installable; equivalent deterministic a11y checks are enforced via existing Vitest tooling and CI gates.
