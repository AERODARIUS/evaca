# SOTRY-12: Condition control redesign (toggle pattern)

## What was implemented
- Replaced the `Condition` dropdown with a single toggle button control.
- Toggle sequence now alternates per activation: `Above` <-> `Below`.
- Added icon + label synchronized with state:
  - `Above` -> up-arrow icon + `Above`
  - `Below` -> down-arrow icon + `Below`
- Added visual states in CSS for hover, active, focus-visible, and condition-specific styling.
- Kept one source of truth (`condition` state), so visible toggle state and submitted payload remain synchronized.

## Files changed
- `app/web/src/components/AlertForm.tsx`
- `app/web/src/styles/app.css`
- `TODO.md`

## Tests executed and results
- `cd app && npm run web:test` -> passed
- `cd app && npm run web:build` -> passed

## Notes/limitations
- Keyboard activation uses native button behavior (`Enter`/`Space`) through the AntD `Button` component.
