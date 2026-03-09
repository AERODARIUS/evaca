# SOTRY-7: Security and ops

## What was implemented
- Strengthened eToro API resilience in Cloud Functions with request timeout controls, retry jitter, and structured duration logging for each outbound call.
- Added bounded in-memory rate-limit bucket cleanup to prevent unbounded growth under noisy traffic.
- Refactored market search to use candidate-based query modes with controlled pagination and deduplication, improving robustness for ticker and free-text search paths.
- Extended function tests to cover search candidate generation behavior.

## Files changed
- `/Users/dariocruz/Documents/eVaca/app/functions/index.js`
- `/Users/dariocruz/Documents/eVaca/app/functions/index.test.js`
- `/Users/dariocruz/Documents/eVaca/TODO.md`

## Tests executed and results
- `cd /Users/dariocruz/Documents/eVaca/app && npm run functions:test`
- Result: Passed (11/11 tests).

## Notes/limitations
- Retry/backoff is currently scoped to eToro request wrappers and auth-protected market data entry points.
- Additional end-to-end scheduler retry behavior is implemented in follow-up stories.
