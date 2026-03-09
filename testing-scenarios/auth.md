# Feature: auth
## Scope
- Authentication UI flows (sign-in/register) and basic client validation behavior.

## Existing Unit Scenarios
- none

## Missing Unit Scenarios (Discovered by QA)
- `GAP-auth-001`: Given unauthenticated users open the root route When auth screen renders Then sign-in form and register toggle are present. | LinkedBug: `none`
- `GAP-auth-002`: Given register mode with mismatched passwords When user submits Then inline mismatch validation is displayed and submit is blocked. | LinkedBug: `none`

## Change Log
- 2026-03-09: Initialized feature scenario file; added auth coverage gaps derived from E2E smoke scope.
