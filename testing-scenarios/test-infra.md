# Feature: test-infra
## Scope
- Automated QA execution reliability, Playwright harness setup, and local test environment constraints.

## Existing Unit Scenarios
- none

## Missing Unit Scenarios (Discovered by QA)
- `GAP-test-infra-001`: Given Playwright webServer starts on configured host/port When E2E suite is invoked in CI/local automation Then server boot succeeds without permission errors. | LinkedBug: `none`

## Change Log
- 2026-03-09: Initialized feature scenario file; recorded E2E environment startup blocker (`listen EPERM 127.0.0.1:4173`).
