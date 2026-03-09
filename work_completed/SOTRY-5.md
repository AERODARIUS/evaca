# SOTRY-5: Implement scheduled price monitoring (Cloud Functions scheduler)

## What was implemented
- Added scheduled Cloud Function `checkAlerts` running every minute.
- The scheduler loads active alerts from Firestore, filters due alerts by `intervalMinutes` and `lastCheckedAt`, and fetches latest rates from eToro.
- Implemented condition evaluation for `above/below` semantics and alert dedupe logic that prevents repeated notifications while the condition remains unchanged.
- When triggered, the scheduler writes a `notifications` document with alert/user linkage and trigger metadata.
- Updated alert timestamps (`lastCheckedAt`, `lastTriggeredAt`, `updatedAt`) after each due evaluation.

## Files changed
- `/Users/dariocruz/Documents/eVaca/app/functions/index.js`
- `/Users/dariocruz/Documents/eVaca/app/functions/index.test.js`
- `/Users/dariocruz/Documents/eVaca/TODO.md`

## Tests executed and results
- `cd /Users/dariocruz/Documents/eVaca/app && npm run functions:test`
- Result: Passed (18/18 tests).

## Notes/limitations
- Notification documents are created with `status: pending`; status transition behavior is completed in the follow-up notification pipeline story.
