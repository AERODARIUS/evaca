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

- [x] `SOTRY-4` Integrate eToro market data via Cloud Functions:
  - Use secrets `ETORO_API_KEY` and `ETORO_USER_KEY`
  - Add callable/HTTP function to search assets (`/market-data/search`)
  - Add function to fetch current rates (`/market-data/instruments/rates`)
  - Map eToro response to internal alert asset shape

- [x] `SOTRY-5` Implement scheduled price monitoring (Cloud Functions scheduler):
  - Run at configured cadence
  - Load active alerts
  - Fetch latest prices from eToro
  - Evaluate trigger conditions
  - Write notification documents to Firestore `notifications` when triggered
  - Prevent duplicate notifications for unchanged conditions

- [x] `SOTRY-6` Add notification delivery pipeline (phase 1: in-app history):
  - Persist each trigger event in `notifications`
  - Mark status (`pending`, `sent`, `failed`)
  - Link notification to alert + user

- [x] `SOTRY-7` Security and ops:
  - Keep all eToro keys only in Functions secrets manager
  - Enforce Firestore security rules per user
  - Add retries + logging for eToro/API failures
  - Add basic rate-limit/backoff handling for polling

- [ ] `SOTRY-8` Testing:
  - Unit tests for condition evaluator
  - Integration tests for alert creation + trigger flow
  - Emulator tests for Firestore + Functions

- [x] `SOTRY-9` Deployment checklist:
  - Confirm secrets are configured in Functions runtime
  - Deploy Firestore indexes/rules
  - Deploy Cloud Functions
  - Smoke test with one real alert end-to-end

## Frontend Design, UX, Quality, and Accessibility

- [x] `SOTRY-10` Ant Design foundation and UI architecture
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

- [x] `SOTRY-11` New Alert information architecture and form UX
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

- [x] `SOTRY-12` Condition control redesign (toggle pattern)
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

- [x] `SOTRY-13` UI consistency and interaction standards
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

## Architecture + Engineering Audit (2026-03-09)

- [x] `STORY-20260309-001` Lock down market-data function access
  - Type: `security`
  - Area: `backend`
  - Problem: `searchEtoroInstruments`, `getEtoroInstrumentRate`, and HTTP wrappers do not enforce authenticated callers, so any client can spend eToro quota and probe backend behavior.
  - Impact: Unauthorized usage, higher billing risk, and larger attack surface on public endpoints.
  - Proposed change: Require Firebase Auth/App Check for callable handlers, restrict or remove unauthenticated HTTP wrappers, and add per-user/per-IP throttling guardrails.
  - Acceptance criteria:
    - Unauthenticated and invalid App Check requests are rejected with `unauthenticated`.
    - Public HTTP wrappers are either removed or protected by verified auth/app token checks.
    - Logs include caller uid (or anonymous marker) and rejection reason without leaking secrets.
  - Dependencies: `none`
  - Priority: `P0`
  - Effort: `M`

- [x] `STORY-20260309-002` Sanitize backend error contracts
  - Type: `security`
  - Area: `backend`
  - Problem: Backend error messages currently propagate upstream provider details directly to clients (`eToro API request failed: ...`), increasing information leakage risk.
  - Impact: Attackers can infer provider behavior and internal integration state from verbose error payloads.
  - Proposed change: Introduce a stable error mapping layer with client-safe messages, internal correlation IDs, and full detail only in structured server logs.
  - Acceptance criteria:
    - Client responses expose only approved message catalog + machine-readable error code.
    - Upstream/provider payload fragments are never returned to callers.
    - Correlation id is returned to client and present in Cloud Logging entries.
  - Dependencies: `STORY-20260309-001`
  - Priority: `P1`
  - Effort: `S`

- [ ] `STORY-20260309-003` Extract shared alert form state + market data client
  - Type: `refactor`
  - Area: `frontend`
  - Problem: `AlertForm` mixes UI, async calls, and duplicated reset/edit state logic, making changes risky and hard to test.
  - Impact: Slower feature delivery, regression-prone edits, and weak reuse for future alert screens.
  - Proposed change: Move form state machine + submit/search/rate side effects into reusable hooks/services (`useAlertEditor`, `marketDataClient`) with typed interfaces.
  - Acceptance criteria:
    - `AlertForm` becomes mostly presentational and consumes extracted hook/service.
    - Reset/edit initialization logic exists in one place only.
    - Unit tests cover hook/service success, validation failure, and async error paths.
  - Dependencies: `SOTRY-10`
  - Priority: `P2`
  - Effort: `M`

- [x] `STORY-20260309-004` Enforce backend code quality gates in CI
  - Type: `quality`
  - Area: `testing`
  - Problem: `functions:lint` is a no-op (`echo 'No lint configured'`), so CI currently reports green without backend static checks.
  - Impact: Preventable defects and insecure patterns can reach production undetected.
  - Proposed change: Add ESLint + formatting checks for `app/functions`, enforce coverage threshold for function tests, and fail PR pipelines on violations.
  - Acceptance criteria:
    - `npm run functions:lint` performs real linting and fails on rule violations.
    - Functions tests publish coverage and enforce minimum threshold in CI.
    - Both GitHub workflows fail when backend quality gates fail.
  - Dependencies: `none`
  - Priority: `P1`
  - Effort: `M`

- [ ] `STORY-20260309-005` Reconcile docs with deployed architecture
  - Type: `tech-debt`
  - Area: `infra`
  - Problem: `app/README.md` documents functions (`checkAlerts`, CRUD functions) that are not implemented in `app/functions/index.js`.
  - Impact: Onboarding friction, operational confusion, and incorrect runbook assumptions during incidents.
  - Proposed change: Update README to match actual runtime behavior and add a lightweight architecture decision log for implemented vs planned capabilities.
  - Acceptance criteria:
    - README function inventory matches exported functions in code.
    - Planned-but-missing capabilities are explicitly marked as backlog items.
    - Local setup/deploy/testing instructions are verified end-to-end.
  - Dependencies: `SOTRY-5`, `SOTRY-6`
  - Priority: `P2`
  - Effort: `S`

### Recommended execution order
1. `STORY-20260309-001`
2. `SOTRY-7`
3. `STORY-20260309-002`
4. `STORY-20260309-004`
5. `SOTRY-5`
6. `SOTRY-6`
7. `SOTRY-9`
8. `SOTRY-10`
9. `SOTRY-11`
10. `SOTRY-12`
11. `SOTRY-13`
12. `STORY-20260309-003`
13. `SOTRY-14`
14. `SOTRY-15`
15. `SOTRY-16`
16. `SOTRY-17`
17. `STORY-20260309-005`

### Story dependencies

- `SOTRY-7` should start with `STORY-20260309-001` hardening and then focus on runtime retry/backoff/logging.
- `STORY-20260309-002` depends on `STORY-20260309-001` to avoid reworking auth/error paths twice.
- `SOTRY-5` depends on `SOTRY-7` baseline resilience controls.
- `SOTRY-6` depends on `SOTRY-5` event generation.
- `SOTRY-9` depends on `SOTRY-5` and `SOTRY-6`.
- `SOTRY-11` depends on `SOTRY-10` token/component foundation.
- `SOTRY-12` depends on `SOTRY-10` and should be included in `SOTRY-11` form layout.
- `SOTRY-13` depends on `SOTRY-10` and `SOTRY-11`.
- `STORY-20260309-003` depends on `SOTRY-10` for stable UI primitives.
- `SOTRY-14` depends on `SOTRY-10` to `SOTRY-13` plus `STORY-20260309-003` for stable component seams.
- `SOTRY-15` depends on `SOTRY-14` results.
- `SOTRY-16` depends on UI implementation from `SOTRY-10` to `SOTRY-13`.
- `SOTRY-17` depends on `SOTRY-14` and `SOTRY-16`.
- `STORY-20260309-005` should be completed after `SOTRY-5` and `SOTRY-6` to document real delivered behavior.
