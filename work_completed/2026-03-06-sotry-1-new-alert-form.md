# SOTRY-1 - New Alert form UI

Date: 2026-03-06

Implemented the first task from `TODO.md` by expanding the `New alert` form in the web app UI.

## What changed
- Added `Alert name` input field.
- Kept and clarified the asset selector as symbol/search input + result picker.
- Updated condition choices to user-facing `Above` / `Below`.
- Kept target price input.
- Kept interval input as `Check interval (minutes)`.
- Added `Notification channel(s)` selector with checkboxes (`In-app`, `Email`, `Push`).
- Added `Enabled status` toggle checkbox.
- Added supporting styles for checkbox labels, wrapped rows, channel fieldset, and helper text.

## Notes
- To preserve compatibility with current backend callable functions, the newly added UI-only fields (`alert name`, `notification channels`, `enabled`) are currently captured in the form state but not sent in the create/update payload yet.
- This aligns with doing `SOTRY-1` first; persistence/wiring is expected in later tasks.

## Validation
- `npm run test` (in `/app`) failed because no `test` script exists in the project.
- `npm run build` (in `/app`) passed successfully.
