# SOTRY-9: Deployment checklist

## What was implemented
- Added a deployment runbook at `app/docs/deployment-checklist.md` covering:
  - secrets verification
  - Firestore rules/index deployment
  - Cloud Functions deployment
  - Hosting deployment
  - manual end-to-end smoke test with expected outcomes
  - rollback guidance
- Added `app/scripts/deploymentChecklist.js` to validate deploy-readiness artifacts and source-level secret bindings.
- Added `deploy:checklist` script in `app/package.json` to run the checklist helper.

## Files changed
- `app/docs/deployment-checklist.md`
- `app/scripts/deploymentChecklist.js`
- `app/package.json`
- `TODO.md`

## Tests executed and results
- `cd app && npm run deploy:checklist` -> passed
- `cd app && npm run functions:lint` -> passed
- `cd app && npm run functions:test` -> passed (20/20)

## Notes/limitations
- Runtime secret existence cannot be fully validated from local source checks alone; the checklist includes required Firebase CLI commands to verify secret access in the target project runtime.
