# SOTRY-13: UI consistency and interaction standards

## What was implemented
- Standardized page interaction patterns by migrating the alerts list to AntD table/card patterns with consistent typography and spacing.
- Normalized button hierarchy in the alerts table actions:
  - `primary` for activate/pause
  - `default` for edit
  - `text` for view/hide details
  - `danger` for delete
- Preserved predictable keyboard/tab navigation in top-to-bottom flow through form and table actions.
- Added consistent loading/empty treatment patterns:
  - skeleton while alerts list is loading
  - empty-state component when no alerts exist
  - skeleton state for asset-search loading inside New Alert form

## Files changed
- `app/web/src/App.tsx`
- `app/web/src/components/AlertsTable.tsx`
- `app/web/src/components/AlertForm.tsx`
- `TODO.md`

## Tests executed and results
- `cd app && npm run web:test` -> passed
- `cd app && npm run web:build` -> passed

## Notes/limitations
- Build reports large JS chunk warning due UI library bundle size; functionality is unaffected.
