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

- [x] `SOTRY-8` Testing:
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

- [x] `SOTRY-14` Test strategy and coverage targets
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

- [x] `SOTRY-15` Defect remediation from unit test findings
  - Product goal: convert failing tests into fixed behavior and prevent repeats.
  - Scope:
  - Run full unit test suite and categorize failures: logic, rendering, async, mock drift.
  - Fix implementation defects and remove brittle state coupling.
  - Align mocks/fixtures with real API/form contracts.
  - Add regression tests for every production bug fixed.
  - Acceptance criteria:
  - Test suite passes locally and in CI.
  - Every previously failing defect has a linked test proving fix.

- [x] `SOTRY-16` Accessibility compliance remediation (WCAG 2.2 AA)
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

- [x] `SOTRY-17` Automated accessibility testing in pipeline
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

- [x] `STORY-20260309-003` Extract shared alert form state + market data client
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
  - Dependencies: `STORY-20260311-001`, `STORY-20260311-002`, `STORY-20260311-003`, `STORY-20260311-004`
  - Priority: `P3`
  - Effort: `S`

- [x] `STORY-20260310-001` Make scheduler evaluation fault-tolerant and bounded
  - Type: `ops`
  - Area: `scheduler`
  - Problem: `checkAlerts` loads all active alerts each minute, and `runAlertEvaluation` processes alerts serially without per-alert isolation, so one upstream rate failure can abort the whole run.
  - Impact: Missed evaluations, long scheduler runtimes, and alert delivery gaps under provider incidents or growth in active alerts.
  - Proposed change: Introduce bounded batches/concurrency, isolate per-alert failures, and persist due-time metadata (for example `nextCheckAt`) so scheduler queries only due alerts instead of scanning all active alerts.
  - Acceptance criteria:
    - A single `fetchEtoroInstrumentRate` failure does not stop processing other due alerts in the same run.
    - Scheduler processes due alerts in bounded chunks with configurable concurrency and logs run metrics (processed, skipped, failed, duration).
    - Due-alert selection is query-driven (no full active-alert scan) and validated with emulator/integration tests.
  - Dependencies: `none`
  - Priority: `P0`
  - Effort: `L`

- [x] `STORY-20260310-002` Replace in-memory API throttling with distributed limits
  - Type: `security`
  - Area: `backend`
  - Problem: Market-data rate limiting uses in-memory `Map` buckets per function instance, which is bypassable across concurrent instances and cold starts.
  - Impact: Quota exhaustion and abuse risk remain under distributed traffic spikes despite apparent local throttling.
  - Proposed change: Move rate limiting to a shared control plane (for example Firestore/Redis-backed token buckets or API Gateway/Cloud Armor quotas) with separate limits for user, IP, and endpoint.
  - Acceptance criteria:
    - Rate limits are enforced consistently across instances for both callable and HTTP market-data endpoints.
    - Abuse tests using concurrent requests across multiple processes trigger deterministic `resource-exhausted` responses.
    - Alerting dashboards/metrics exist for throttled requests and near-quota thresholds.
  - Dependencies: `none`
  - Priority: `P1`
  - Effort: `M`

- [x] `STORY-20260310-003` Add pagination and hard limits to alert/notification reads
  - Type: `performance`
  - Area: `notifications`
  - Problem: `listUserNotifications` and frontend alert listing fetch all matching documents and sort in memory, with no page size cap or cursor contract.
  - Impact: Query latency and memory usage scale linearly with user history, increasing cost and creating avoidable DoS pressure on read-heavy users.
  - Proposed change: Introduce cursor-based pagination with max page size, server-side ordered queries, and frontend incremental loading for alerts/notifications.
  - Acceptance criteria:
    - Backend notification reads use Firestore `orderBy` + `limit` + cursor tokens and reject oversized page-size requests.
    - Frontend alert/notification views load incrementally and no longer call unbounded `getDocs` for user collections.
    - Tests cover first-page, next-page, and empty-page behavior plus index requirements.
  - Dependencies: `none`
  - Priority: `P1`
  - Effort: `M`

- [x] `STORY-20260310-004` Externalize Firebase runtime config by environment
  - Type: `architecture`
  - Area: `frontend`
  - Problem: Firebase web config is hardcoded in source, coupling all local/CI builds to a single project and making environment separation brittle.
  - Impact: Higher risk of accidental writes to the wrong Firebase project and slower setup for staging/test environments.
  - Proposed change: Read Firebase config from typed Vite environment variables with startup validation and documented `.env` templates per environment.
  - Acceptance criteria:
    - `web/src/lib/firebase.ts` reads all Firebase identifiers from env variables rather than hardcoded literals.
    - App startup fails fast with actionable errors when required env vars are missing or malformed.
    - README/deployment docs include env setup for local, preview, and production targets.
  - Dependencies: `none`
  - Priority: `P2`
  - Effort: `S`

## Architecture + Engineering Audit (2026-03-11)

- [x] `STORY-20260311-001` Align Firestore rules and indexes with due-alert scheduling
  - Type: `architecture`
  - Area: `infra`
  - Problem: Alert writes now include `nextCheckAt`, and scheduler/list queries depend on `nextCheckAt` and `createdAt` ordering, but current `firestore.rules` and `firestore.indexes.json` do not fully match these runtime query/write contracts.
  - Impact: Alert create/update operations can fail with permission/index errors, scheduler runs can stall on missing indexes, and production behavior becomes environment-dependent.
  - Proposed change: Update alert security rules to validate `nextCheckAt` and add required composite indexes for scheduler/listing query paths (`isActive + nextCheckAt`, `userId + createdAt + __name__`), then verify with emulator query/write tests.
  - Acceptance criteria:
    - Alert create/update from the web client succeeds with `nextCheckAt` present and validated.
    - Scheduler due-alert query (`isActive == true` + `nextCheckAt <= now` + `orderBy(nextCheckAt)`) runs without index errors.
    - Alert list pagination query (`userId` + ordered `createdAt` + doc id cursor) runs without index errors.
  - Dependencies: `none`
  - Priority: `P0`
  - Effort: `M`

- [x] `STORY-20260311-002` Add scheduler idempotency guard for overlapping runs
  - Type: `ops`
  - Area: `scheduler`
  - Problem: `checkAlerts` can overlap across scheduler invocations; notification creation is not protected by a durable idempotency key/transaction boundary, so concurrent runs can emit duplicate trigger notifications.
  - Impact: Users can receive duplicate alerts, trust degrades, and notification volume/costs increase during high load or slow provider responses.
  - Proposed change: Introduce an idempotent trigger write strategy (for example deterministic dedupe key per alert + check window in a transaction) and lock/lease semantics for due-alert processing.
  - Acceptance criteria:
    - Concurrent scheduler run simulation does not create duplicate notifications for the same alert/trigger window.
    - Notification creation path is transactional/idempotent and retries are safe.
    - Tests cover overlapping scheduler execution and verify single notification emission.
  - Dependencies: `STORY-20260311-001`
  - Priority: `P1`
  - Effort: `L`

- [ ] `STORY-20260311-003` Add Firestore rules security regression tests
  - Type: `security`
  - Area: `testing`
  - Problem: There are no Firestore security-rules emulator tests validating tenant isolation and write constraints for `alerts` and `notifications`.
  - Impact: Rule regressions can silently expose cross-user data or break critical writes until discovered in production.
  - Proposed change: Add `@firebase/rules-unit-testing` coverage for owner-only reads/writes, immutable field constraints, and blocked notification client writes; run tests in CI.
  - Acceptance criteria:
    - Tests assert users cannot read/write another user’s alerts or notifications.
    - Tests assert `alerts.createdAt` immutability and userId ownership constraints on update.
    - CI fails when security-rules tests fail.
  - Dependencies: `STORY-20260311-001`
  - Priority: `P1`
  - Effort: `M`

- [ ] `STORY-20260311-004` Add dependency vulnerability scanning and patch cadence
  - Type: `security`
  - Area: `infra`
  - Problem: CI does not enforce dependency vulnerability scanning for workspace and functions packages.
  - Impact: Known vulnerable transitive dependencies can remain in production without visibility or SLA-backed remediation.
  - Proposed change: Add automated `npm audit` (or equivalent) with severity thresholds in CI, create a monthly patch workflow, and document emergency patch protocol.
  - Acceptance criteria:
    - PR workflow fails on configured high/critical dependency vulnerabilities.
    - Scheduled workflow/report surfaces vulnerable packages and ownership for remediation.
    - Documentation defines patch SLA and rollback procedure for emergency upgrades.
  - Dependencies: `none`
  - Priority: `P2`
  - Effort: `S`

- [ ] `STORY-20260311-005` Upgrade runtime from Node.js 20 before EOL cutoff
  - Type: `maintenance`
  - Area: `infra`
  - Problem: Node.js 20 reaches end-of-life on `2026-04-30` (obsoleta) and retirement on `2026-10-30`, while current runtime references still target Node 20.
  - Impact: Security patch gap, higher incident risk, and potential deployment/runtime incompatibilities once Node 20 is retired.
  - Proposed change: Upgrade all project runtimes (Cloud Functions, local dev, CI, and docs) from Node.js 20 to the latest available supported Node.js runtime and validate compatibility.
  - Acceptance criteria:
    - `app/functions/package.json` and related runtime config target the latest available Node.js runtime (not 20).
    - CI and local tooling (`.nvmrc`/`.node-version` if present, workflows, scripts) are aligned to the same runtime major version.
    - Test suite and deploy smoke checks pass on the upgraded runtime with no Node-version drift in docs.
  - Dependencies: `none`
  - Priority: `P1`
  - Effort: `M`

### Recommended execution order
1. `STORY-20260311-001`
2. `STORY-20260311-002`
3. `STORY-20260311-003`
4. `STORY-20260311-005`
5. `STORY-20260311-004`
6. `STORY-20260309-005`

### Story dependencies

- `STORY-20260311-001` has no hard prerequisite and should run first because it removes immediate runtime failures in alert write/query paths.
- `STORY-20260311-002` depends on scheduler/query contract stability from `STORY-20260311-001`.
- `STORY-20260311-003` should run after `STORY-20260311-001` so rule/query test fixtures match the finalized alert schema.
- `STORY-20260311-005` should run before broader dependency/security hardening so CI, Functions, and tooling all evaluate on the current supported Node runtime.
- `STORY-20260311-004` is independent and can run in parallel, but stays after P0/P1 runtime risk reducers.
- `SOTRY-14` depends on `SOTRY-10` to `SOTRY-13` plus `STORY-20260309-003` for stable component seams.
- `SOTRY-15` depends on `SOTRY-14` results.
- `SOTRY-16` depends on UI implementation from `SOTRY-10` to `SOTRY-13`.
- `SOTRY-17` depends on `SOTRY-14` and `SOTRY-16`.
- `STORY-20260309-005` remains a final documentation sync step after active architecture/security changes land.
