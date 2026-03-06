# SOTRY-3 - Wire form submission to Firestore

## What was implemented

- Replaced alert CRUD callable-function dependencies in the web app with direct Firestore operations for:
  - Create alert
  - List alerts
  - Update alert
  - Delete alert
  - Toggle active/paused state
- Added a dedicated alerts data layer in `web/src/lib/alerts.ts` to centralize Firestore persistence and mapping.
- Added client-side validation in `web/src/lib/alertValidation.ts` for alert payloads before write attempts.
- Kept server-side validation enforced through existing Firestore security rules (`firestore.rules`) on create/update payload shape and allowed fields.
- Updated UI integration:
  - `AlertForm` now saves to Firestore through the new data layer and displays validation/runtime errors.
  - `AlertsTable` now supports toggle active/paused and delete using Firestore.
  - `App` now loads alerts directly from Firestore by authenticated `userId`.
- Aligned TypeScript alert types with Firestore-backed fields and timestamps.

## Tests run

- `npm test` (from `app/`) - passed
- `npm run build` (from `app/`) - passed (includes TypeScript check)

## Notes

- Existing eToro search/rate callable usage in the form remains unchanged.
- Build warning about large bundle size is unchanged and unrelated to this story.
