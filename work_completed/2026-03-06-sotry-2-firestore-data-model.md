# SOTRY-2 - Firestore data model

Date: 2026-03-06

## Summary
Implemented the first unchecked task from `TODO.md` by defining the Firestore data model for `alerts` and `notifications`.

## Changes made
- Added schema types in `app/web/src/types.ts`:
  - `AlertDocument`
  - `NotificationDocument`
  - `FirestoreAlertCondition`
  - `NotificationStatus`
- Replaced permissive temporary Firestore rules with user-scoped model rules in `app/firestore.rules`:
  - Scoped reads/writes for `alerts` by `userId == request.auth.uid`
  - Added field-level validation for `alerts` payloads
  - Added read-only access for users on `notifications` (write path reserved for backend/Admin SDK)
- Added composite indexes in `app/firestore.indexes.json` for common alert and notification queries.
- Documented the data model in `app/README.md`.
- Marked `SOTRY-2` as completed in `TODO.md`.

## Validation
- `npm run test` (in `app`) -> failed because no `test` script exists in this workspace.
- `npm run test -w web` -> failed because no `test` script exists in `web/package.json`.
- `npm run build` (in `app`) -> succeeded.
