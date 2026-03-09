# SOTRY-6: Add notification delivery pipeline (phase 1: in-app history)

## What was implemented
- Extended notification flow in scheduled monitoring so trigger events are persisted with delivery lifecycle statuses:
  - Create notification as `pending`
  - Mark as `sent` after persistence completes
  - Mark as `failed` with `errorMessage` if delivery status update fails
- Added callable function `listUserNotifications` (auth + App Check protected) to fetch user-scoped in-app notification history.
- Added helper logic for safe/truncated failure messages to keep stored error payloads bounded.

## Files changed
- `/Users/dariocruz/Documents/eVaca/app/functions/index.js`
- `/Users/dariocruz/Documents/eVaca/app/functions/index.test.js`
- `/Users/dariocruz/Documents/eVaca/TODO.md`

## Tests executed and results
- `cd /Users/dariocruz/Documents/eVaca/app && npm run functions:test` -> Passed (20/20 tests)
- `cd /Users/dariocruz/Documents/eVaca/app && npm run functions:lint` -> Passed

## Notes/limitations
- Delivery status transition currently reflects in-app persistence lifecycle only (phase 1), not external channels like email/SMS.
