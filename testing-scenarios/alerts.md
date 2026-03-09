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

## Change Log
- 2026-03-09: Initialized feature scenario file; captured existing unit scenarios and new gap candidates.
