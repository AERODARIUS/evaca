# SOTRY-11: New Alert information architecture and form UX

## What was implemented
- Reorganized the New Alert form into explicit sections:
  - `Asset`
  - `Trigger`
  - `Notifications`
  - `Status`
- Improved labels/placeholders/helper text and field-specific validation copy.
- Added deterministic asset search states:
  - `loading`
  - `results`
  - `empty`
  - `error`
- Added deterministic submit feedback:
  - success alert after save
  - actionable error message when submit fails
- Kept primary CTA as visually dominant (`type="primary"`) and retained a differentiated secondary action for edit cancel.

## Files changed
- `app/web/src/components/AlertForm.tsx`
- `TODO.md`

## Tests executed and results
- `cd app && npm run web:test` -> passed
- `cd app && npm run web:build` -> passed

## Notes/limitations
- None.
