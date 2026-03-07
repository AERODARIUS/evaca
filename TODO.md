# New Alert Form + eToro + Firebase

- [x] `SOTRY-1` Build `New Alert` form UI in app:
  - Alert name
  - Asset selector (symbol/search)
  - Condition (`above` / `below`)
  - Target price
  - Check interval
  - Notification channel(s)
  - Enabled/disabled status

- [x] `SOTRY-2` Create Firestore data model:
  - `alerts` collection (user-scoped alert definitions)
  - `notifications` collection (trigger history + delivery status)
  - Suggested alert fields: `userId`, `instrumentId`, `symbol`, `displayName`, `condition`, `targetPrice`, `isActive`, `intervalMinutes`, `lastCheckedAt`, `lastTriggeredAt`, `createdAt`, `updatedAt`

- [x] `SOTRY-3` Wire form submission to Firestore:
  - Validate input client-side and server-side
  - Save alert documents to `alerts`
  - Add edit/delete/toggle active support

- [ ] `SOTRY-4` Integrate eToro market data via Cloud Functions:
  - Use secrets `ETORO_APP_KEY` and `ETORO_USER_KEY`
  - Add callable/HTTP function to search assets (`/market-data/search`)
  - Add function to fetch current rates (`/market-data/instruments/rates`)
  - Map eToro response to internal alert asset shape

- [ ] `SOTRY-5` Implement scheduled price monitoring (Cloud Functions scheduler):
  - Run at configured cadence
  - Load active alerts
  - Fetch latest prices from eToro
  - Evaluate trigger conditions
  - Write notification documents to Firestore `notifications` when triggered
  - Prevent duplicate notifications for unchanged conditions

- [ ] `SOTRY-6` Add notification delivery pipeline (phase 1: in-app history):
  - Persist each trigger event in `notifications`
  - Mark status (`pending`, `sent`, `failed`)
  - Link notification to alert + user

- [ ] `SOTRY-7` Security and ops:
  - Keep all eToro keys only in Functions secrets manager
  - Enforce Firestore security rules per user
  - Add retries + logging for eToro/API failures
  - Add basic rate-limit/backoff handling for polling

- [ ] `SOTRY-8` Testing:
  - Unit tests for condition evaluator
  - Integration tests for alert creation + trigger flow
  - Emulator tests for Firestore + Functions

- [ ] `SOTRY-9` Deployment checklist:
  - Confirm secrets are configured in Functions runtime
  - Deploy Firestore indexes/rules
  - Deploy Cloud Functions
  - Smoke test with one real alert end-to-end

## Frontend Design, UX, Quality, and Accessibility

- [ ] `SOTRY-10` Ant Design foundation and UI architecture
  - Product goal: establish a consistent design system for faster feature delivery and lower UI bugs.
  - Scope:
  - Install/configure Ant Design in React app.
  - Define theme tokens for colors, typography, spacing, border radius, shadows.
  - Create shared primitives: `PageSection`, `FormRow`, `FieldHint`, `ActionBar`.
  - Migrate `New Alert` controls to AntD (`Form`, `Input`, `Select`, `InputNumber`, `Switch`, `Button`).
  - Technical notes:
  - Tokens must be centralized in one theme file and consumed via `ConfigProvider`.
  - Avoid inline style duplication; use reusable component-level styling.
  - Acceptance criteria:
  - `New Alert` screen uses AntD components end-to-end.
  - Theme tokens are applied consistently with no mixed legacy styles in this screen.
  - Layout works in mobile (<= 768px), tablet (769-1024px), desktop (>= 1025px).

- [ ] `SOTRY-11` New Alert information architecture and form UX
  - Product goal: reduce completion time and prevent user input errors.
  - Scope:
  - Reorganize form into logical groups: `Asset`, `Trigger`, `Notifications`, `Status`.
  - Improve field labels, placeholders, helper text, and error copy.
  - Add explicit states for asset search: loading, empty, error, results.
  - Add post-submit feedback: success message and actionable error message.
  - Design requirements:
  - Each section has clear heading and spacing rhythm.
  - Primary CTA is visually dominant; secondary/destructive actions are differentiated.
  - Acceptance criteria:
  - All validation messages are user-friendly and field-specific.
  - Search and submit flows always show deterministic state feedback.
  - Form completion requires no ambiguous inputs.

- [ ] `SOTRY-12` Condition control redesign (toggle pattern)
  - User story: as a user, I can switch condition quickly without opening a dropdown.
  - Scope:
  - Replace `Condition` select with a single toggle button control.
  - Toggle sequence per click: `Above` -> `Below` -> `Above`...
  - Visual states:
  - `Above`: up-arrow icon + `Above` label.
  - `Below`: down-arrow icon + `Below` label.
  - Add hover, active, focus-visible, disabled states.
  - Technical notes:
  - Control must stay bound to form value and validation (`condition` required).
  - Prefer AntD button + controlled React state; avoid duplicated source of truth.
  - Acceptance criteria:
  - Click and keyboard activation (`Enter`/`Space`) both toggle state.
  - Submitted payload always matches visible toggle state.
  - Icon, label, and stored value stay synchronized.

- [ ] `SOTRY-13` UI consistency and interaction standards
  - Product goal: make the page feel cohesive, predictable, and faster to scan.
  - Scope:
  - Standardize spacing scale, heading styles, and field alignment.
  - Normalize button hierarchy (`primary`, `default`, `text`, `danger`).
  - Ensure predictable tab order and no keyboard traps.
  - Add skeleton/loading treatment where async content appears.
  - Definition of done:
  - No inconsistent spacing/typography deviations within `New Alert`.
  - Keyboard navigation order matches visual top-to-bottom flow.
  - Loading and empty states follow same component patterns.

- [ ] `SOTRY-14` Test strategy and coverage targets
  - Product goal: reduce regressions and speed up confident releases.
  - Scope:
  - Add unit tests for validation rules and form submission paths.
  - Add tests for condition toggle transitions, icons, and submitted values.
  - Add tests for asset search states (loading, success, empty, error).
  - Add tests for edit/delete/enable-disable alert actions.
  - Coverage target (minimum, enforced in CI):
  - `statements >= 85%`
  - `branches >= 80%`
  - `functions >= 85%`
  - `lines >= 85%`
  - Acceptance criteria:
  - CI fails when thresholds are not met.
  - New tests are deterministic (no flaky timing/network assumptions).

- [ ] `SOTRY-15` Defect remediation from unit test findings
  - Product goal: convert failing tests into fixed behavior and prevent repeats.
  - Scope:
  - Run full unit test suite and categorize failures: logic, rendering, async, mock drift.
  - Fix implementation defects and remove brittle state coupling.
  - Align mocks/fixtures with real API/form contracts.
  - Add regression tests for every production bug fixed.
  - Acceptance criteria:
  - Test suite passes locally and in CI.
  - Every previously failing defect has a linked test proving fix.

- [ ] `SOTRY-16` Accessibility compliance remediation (WCAG 2.2 AA)
  - Product goal: make critical flows usable for keyboard and assistive technology users.
  - Scope:
  - Audit `New Alert` with automated tools and manual keyboard/screen-reader checks.
  - Fix label association, accessible names, and ARIA for custom/toggle controls.
  - Ensure visible focus, sufficient contrast, semantic structure, and error announcements.
  - Verify non-color indicators for state/error/success messaging.
  - Technical notes:
  - Prefer native semantics first; use ARIA only when native element is insufficient.
  - Acceptance criteria:
  - No critical accessibility violations on audited screens.
  - Form can be fully completed using keyboard only.
  - Validation and status changes are announced to screen readers.

- [ ] `SOTRY-17` Automated accessibility testing in pipeline
  - Product goal: prevent accessibility regressions from re-entering the app.
  - Scope:
  - Add automated a11y tests (`jest-axe` or equivalent) for key UI states.
  - Cover `New Alert` default state, validation errors, condition toggle interaction, and submit feedback.
  - Add CI gate for high-severity accessibility violations.
  - Document a lightweight manual accessibility checklist for PR reviewers.
  - Acceptance criteria:
  - Accessibility tests run in CI on every PR.
  - PR cannot merge when critical violations are detected.

### Recommended implementation order (to avoid rework)

1. `SOTRY-10` (design system foundation)
2. `SOTRY-11` (form information architecture)
3. `SOTRY-12` (condition toggle control)
4. `SOTRY-13` (visual/interaction consistency pass)
5. `SOTRY-14` (test expansion + coverage gates)
6. `SOTRY-15` (fix defects found by tests)
7. `SOTRY-16` (manual + automated accessibility remediation)
8. `SOTRY-17` (pipeline-level accessibility guardrails)

### Story dependencies

- `SOTRY-11` depends on `SOTRY-10` token/component foundation.
- `SOTRY-12` depends on `SOTRY-10` and should be included in `SOTRY-11` form layout.
- `SOTRY-13` depends on `SOTRY-10` and `SOTRY-11`.
- `SOTRY-14` can start in parallel, but final assertions depend on `SOTRY-10` to `SOTRY-13`.
- `SOTRY-15` depends on `SOTRY-14` results.
- `SOTRY-16` depends on UI implementation from `SOTRY-10` to `SOTRY-13`.
- `SOTRY-17` depends on `SOTRY-14` and `SOTRY-16`.
