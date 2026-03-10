# SOTRY-15: Defect remediation from unit test findings

## Story ID and title
- `SOTRY-15` Defect remediation from unit test findings

## What was implemented
- Ran the full unit test suite (`web` + `functions`) and reviewed contract-sensitive form logic.
- Remediated a logic defect: client-side validation accepted fractional `intervalMinutes`, but backend contract requires integer minutes.
- Added a regression test proving fractional intervals are rejected before submit payload creation.
- Kept behavior for valid integer intervals unchanged.

## Files changed
- `app/web/src/lib/alertFormLogic.ts`
- `app/web/src/lib/alertFormLogic.test.ts`

## Tests executed and results
- `npm test` ✅ passed (`web`: `4` files, `15` tests)
- `npm run functions:test` ✅ passed (`22` tests)

## Notes/limitations
- No additional failing tests were found after remediation; full suites remained green.
