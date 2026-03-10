# Accessibility PR Checklist (New Alert)

Use this checklist in pull requests affecting the New Alert workflow.

## Automated checks
- Run `npm run web:test:a11y`.
- Verify CI passes the same check in PR pipeline.

## Manual checks (quick pass)
- Keyboard-only: complete alert creation without mouse and no keyboard trap.
- Focus visibility: every interactive control has visible focus indicator.
- Labels and names: each input has an understandable accessible name.
- Error feedback: validation errors are explicit and understandable.
- Status announcements: search and submit feedback are announced by assistive tech.
- Non-color indicators: success/error/state is identifiable without relying only on color.
