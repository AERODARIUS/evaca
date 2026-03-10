# SOTRY-16: Accessibility compliance remediation (WCAG 2.2 AA)

## Story ID and title
- `SOTRY-16` Accessibility compliance remediation (WCAG 2.2 AA)

## What was implemented
- Improved New Alert screen accessibility semantics and announcements:
  - Added `aria-live` status regions for search feedback and submit success/error feedback.
  - Marked error feedback as assertive (`role="alert"`) and success/status as polite (`role="status"`).
  - Added explicit `aria-describedby` wiring for condition toggle and interval helper text.
  - Added `aria-pressed` to the condition toggle to expose state to assistive tech.
- Strengthened keyboard visibility:
  - Added consistent, high-contrast `:focus-visible` outlines for interactive controls.
- Increased visual contrast for condition toggle variants to better meet AA contrast expectations.
- Preserved existing form behavior while improving semantic accessibility affordances.

## Files changed
- `app/web/src/components/AlertForm.tsx`
- `app/web/src/components/primitives/index.tsx`
- `app/web/src/styles/app.css`

## Tests executed and results
- `npm run web:test` ✅ passed (`4` files, `15` tests)
- `npm run web:build` ✅ passed

## Notes/limitations
- Manual screen-reader walkthroughs were not executable in this headless environment; improvements target known semantic and announcement gaps in the New Alert flow.
