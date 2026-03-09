# SOTRY-10: Ant Design foundation and UI architecture

## What was implemented
- Added Ant Design to frontend dependencies and wired global design tokens via `ConfigProvider`.
- Introduced centralized theme tokens in `web/src/theme/theme.ts`.
- Added shared UI primitives:
  - `PageSection`
  - `FormRow`
  - `FieldHint`
  - `ActionBar`
- Migrated `New Alert` UI controls to AntD components end-to-end (`Form`, `Input`, `Select`, `InputNumber`, `Switch`, `Button`, plus `Card/Alert/Checkbox`).
- Updated styles to remove duplicated legacy form control styling and provide responsive layout behavior for mobile/tablet/desktop.

## Files changed
- `app/web/package.json`
- `app/web/src/main.tsx`
- `app/web/src/theme/theme.ts`
- `app/web/src/components/primitives/index.tsx`
- `app/web/src/components/AlertForm.tsx`
- `app/web/src/styles/app.css`
- `TODO.md`

## Tests executed and results
- `cd app && npm run web:test` -> passed
- `cd app && npm run web:build` -> passed

## Notes/limitations
- npm registry access is blocked in this environment, so dependency install from the internet could not be executed here. Validation used locally available AntD v5 modules present on disk.
