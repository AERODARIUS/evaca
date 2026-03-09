# Feature: scheduler
## Scope
- Scheduled polling cadence, active alert loading, condition evaluation trigger loop, and deduplication behavior.

## Existing Unit Scenarios
- none

## Missing Unit Scenarios (Discovered by QA)
- `GAP-scheduler-001`: Given active alerts exist When scheduler executes at configured cadence Then each alert is evaluated once per run and persisted timestamps update correctly. | LinkedBug: `none`
- `GAP-scheduler-002`: Given provider timeout/intermittent failure When scheduler executes Then retry/backoff path logs error and avoids crashing the run. | LinkedBug: `none`

## Change Log
- 2026-03-09: Initialized feature scenario file; added baseline unit coverage gaps.
