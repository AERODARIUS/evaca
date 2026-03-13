# Feature: alerts
## Scope
- Alert condition evaluation and alert input validation for create/edit alert flows.

## Existing Unit Scenarios
- `US-alerts-001`: Given condition `gte` and currentPrice >= targetPrice When evaluator runs Then it returns true.
- `US-alerts-002`: Given condition `lte` and currentPrice <= targetPrice When evaluator runs Then it returns true.
- `US-alerts-003`: Given condition `gte` and currentPrice < targetPrice When evaluator runs Then it returns false.
- `US-alerts-004`: Given condition `lte` and currentPrice > targetPrice When evaluator runs Then it returns false.
- `US-alerts-005`: Given a valid alert payload When validation runs Then it returns no errors.
- `US-alerts-006`: Given an invalid alert payload When validation runs Then it returns field-level validation errors.

## Missing Unit Scenarios (Discovered by QA)
- `GAP-alerts-001`: Given alert payloads at interval boundary values (1 and 1440) When validation runs Then both boundaries are accepted and out-of-range values fail. | LinkedBug: `none`
- `GAP-alerts-002`: Given condition values from UI labels (`above`/`below`) When mapped to evaluator input Then condition mapping remains consistent with `gte`/`lte`. | LinkedBug: `none`

## Missing Integration Scenarios (Access Control Incident)
- `GAP-alerts-003`: Given an authenticated user with no existing alerts When they create a new alert Then Firestore accepts the write and persists `userId == auth.uid`. | LinkedBug: `permissions-incident-2026-03-13`
- `GAP-alerts-004`: Given an authenticated owner with existing alerts When they load the alerts page Then only their alerts are returned and pagination succeeds without permission errors. | LinkedBug: `permissions-incident-2026-03-13`
- `GAP-alerts-005`: Given an authenticated user attempting to read or mutate another user’s alert When the operation is executed Then Firestore rejects the request. | LinkedBug: `permissions-incident-2026-03-13`
- `GAP-alerts-006`: Given an unauthenticated client When it attempts to list or save alerts Then the request is rejected and the UI prompts for authentication. | LinkedBug: `permissions-incident-2026-03-13`
- `GAP-alerts-007`: Given a legacy alert document missing a currently required field When the owner loads or edits alerts Then the system reports the document as non-compliant through diagnostics or migration tooling instead of failing silently. | LinkedBug: `permissions-incident-2026-03-13`

## Change Log
- 2026-03-09: Initialized feature scenario file; captured existing unit scenarios and new gap candidates.
- 2026-03-13: Added access-control regression scenarios for owner-only alert CRUD and legacy-document compliance.
