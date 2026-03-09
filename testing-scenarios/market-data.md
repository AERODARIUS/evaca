# Feature: market-data
## Scope
- Market instrument lookup and current rate retrieval integrations used by alert creation and evaluation.

## Existing Unit Scenarios
- none

## Missing Unit Scenarios (Discovered by QA)
- `GAP-market-data-001`: Given successful instrument search responses When market-data client maps provider payload Then normalized instrument fields are complete and typed. | LinkedBug: `none`
- `GAP-market-data-002`: Given provider/network failures When market-data client receives error responses Then user-safe error messages are returned without provider internals. | LinkedBug: `none`

## Change Log
- 2026-03-09: Initialized feature scenario file; added baseline unit coverage gaps.
